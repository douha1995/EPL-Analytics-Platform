"""
Multi-Team Backfill Script - Scrape any EPL team's data from Understat

Usage:
    python backfill_team.py --team Manchester_United --seasons 2024,2023
    python backfill_team.py --team Arsenal --seasons 2024
    python backfill_team.py --team Liverpool --seasons 2024,2023,2022
"""

import argparse
import logging
import sys
import uuid
import time
from typing import List, Dict, Any

from playwright_scraper import UnderstatPlaywrightScraper
from db_loader import DatabaseLoader

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

# Supported EPL teams on Understat (use underscores for spaces)
SUPPORTED_TEAMS = [
    "Arsenal",
    "Manchester_United",
    "Manchester_City",
    "Liverpool",
    "Chelsea",
    "Tottenham",
    "Newcastle_United",
    "Brighton",
    "Aston_Villa",
    "Brentford",
    "Fulham",
    "Crystal_Palace",
    "Everton",
    "Leeds",
    "Leicester",
    "Nottingham_Forest",
    "Southampton",
    "West_Ham",
    "Wolverhampton_Wanderers",
    "Bournemouth",
    "Ipswich",
    "Luton"
]


def convert_season_to_display(season_year: str) -> str:
    """Convert season year to display format (e.g., '2024' -> '2024-25')"""
    year = int(season_year)
    return f"{year}-{str(year + 1)[-2:]}"


def convert_team_to_display(team_name: str) -> str:
    """Convert URL team name to display format (e.g., 'Manchester_City' -> 'Manchester City')"""
    return team_name.replace('_', ' ')


def scrape_team_season(
    team_name: str,
    season: str,
    scraper: UnderstatPlaywrightScraper,
    loader: DatabaseLoader
) -> Dict[str, int]:
    """
    Scrape all played matches for a team in a season

    Args:
        team_name: Team name (e.g., "Manchester_United")
        season: Season year (e.g., "2024" for 2024-25)
        scraper: Playwright scraper instance
        loader: Database loader instance

    Returns:
        Dictionary with success/error counts
    """
    season_display = convert_season_to_display(season)
    team_display = convert_team_to_display(team_name)
    logger.info(f"\n{'='*60}")
    logger.info(f"SCRAPING {team_display.upper()} - {season_display} SEASON")
    logger.info(f"{'='*60}")

    stats = {'success': 0, 'errors': 0, 'skipped': 0}
    errors = []

    # Get all fixtures for this team and season
    logger.info(f"Fetching fixtures from Understat for {team_name} ({season})...")
    try:
        fixtures = scraper.scrape_season_fixtures(season, team_name)
    except Exception as e:
        logger.error(f"Failed to fetch fixtures: {e}")
        return stats

    if not fixtures:
        logger.warning(f"No fixtures found for {team_name} in {season}")
        return stats

    logger.info(f"Found {len(fixtures)} total fixtures")

    # Filter for completed matches
    played_matches = [f for f in fixtures if f.get('is_result', False)]
    logger.info(f"Found {len(played_matches)} completed matches")

    if not played_matches:
        logger.warning(f"No completed matches found for {team_name} in {season}")
        return stats

    # Check which matches already exist in database for this team (using display format)
    existing_match_ids = loader.get_existing_matches_for_team(team_display, season_display)
    logger.info(f"Found {len(existing_match_ids)} existing matches in database")

    # Filter out existing matches
    matches_to_scrape = [
        m for m in played_matches
        if m.get('match_id') not in existing_match_ids
    ]

    if not matches_to_scrape:
        logger.info(f"All {len(played_matches)} matches already scraped for {team_name}!")
        stats['skipped'] = len(played_matches)
        return stats

    logger.info(f"Will scrape {len(matches_to_scrape)} new matches")

    # Scrape each match
    for i, fixture in enumerate(matches_to_scrape, 1):
        match_id = fixture.get('match_id')
        match_url = fixture.get('match_url')
        home_team = fixture.get('home_team', '')
        away_team = fixture.get('away_team', '')
        match_date = fixture.get('match_date', '')

        logger.info(f"\n[{i}/{len(matches_to_scrape)}] {match_date}: {home_team} vs {away_team}")
        logger.info(f"URL: {match_url}")

        try:
            # Scrape match shots
            match_data = scraper.scrape_match_shots(
                match_url,
                home_team=home_team,
                away_team=away_team,
                match_date=match_date
            )

            if not match_data or not match_data.get('shots'):
                logger.warning(f"No shot data found for {match_id}")
                stats['errors'] += 1
                errors.append(f"{home_team} vs {away_team}: No shot data")
                continue

            # Create scrape run
            run_id = f"backfill_{team_name}_{uuid.uuid4().hex[:8]}"
            loader.create_scrape_run(run_id, match_id, 'understat', None)

            # Save match reference with team_name (using display format with spaces)
            loader.save_match_reference(
                match_url=match_url,
                home_team=home_team,
                away_team=away_team,
                match_date=match_date,
                season=season_display,
                team_name=team_display
            )

            # Save Understat data with team_name (using display format with spaces)
            loader.save_understat_raw(
                match_id,
                match_data,
                match_url,
                run_id,
                team_name=team_display
            )

            loader.update_scrape_run(run_id, 'success', len(match_data['shots']))

            home_xg = match_data.get('home_xg', 0)
            away_xg = match_data.get('away_xg', 0)
            shots = len(match_data.get('shots', []))
            logger.info(f"✓ Success: {shots} shots, xG: {home_xg:.2f}-{away_xg:.2f}")

            stats['success'] += 1

            # Rate limiting - be respectful to servers
            if i < len(matches_to_scrape):
                time.sleep(3)

        except Exception as e:
            error_msg = str(e)
            logger.error(f"✗ Error: {error_msg}")
            stats['errors'] += 1
            errors.append(f"{home_team} vs {away_team}: {error_msg}")
            continue

    # Summary for this season
    logger.info(f"\n{team_name} {season_display} Summary:")
    logger.info(f"  ✓ Success: {stats['success']}")
    logger.info(f"  ✗ Errors: {stats['errors']}")
    logger.info(f"  ⏭ Skipped (existing): {stats['skipped']}")

    if errors:
        logger.info("\nFailed matches:")
        for error in errors[:5]:
            logger.info(f"  - {error}")
        if len(errors) > 5:
            logger.info(f"  ... and {len(errors) - 5} more")

    return stats


def main():
    parser = argparse.ArgumentParser(
        description="Backfill EPL team data from Understat"
    )
    parser.add_argument(
        "--team",
        required=True,
        help=f"Team name (e.g., Manchester_United, Arsenal). Supported: {', '.join(SUPPORTED_TEAMS[:5])}..."
    )
    parser.add_argument(
        "--seasons",
        required=True,
        help="Comma-separated season years (e.g., 2024,2023 for 2024-25 and 2023-24)"
    )

    args = parser.parse_args()

    team_name = args.team
    seasons = [s.strip() for s in args.seasons.split(',')]

    # Validate team name
    if team_name not in SUPPORTED_TEAMS:
        logger.error(f"Unsupported team: {team_name}")
        logger.info(f"Supported teams: {', '.join(SUPPORTED_TEAMS)}")
        sys.exit(1)

    logger.info("="*60)
    logger.info(f"EPL TEAM BACKFILL: {team_name}")
    logger.info(f"Seasons: {', '.join(seasons)}")
    logger.info("="*60)

    # Initialize scraper and loader
    scraper = UnderstatPlaywrightScraper()
    loader = DatabaseLoader()

    # Track overall stats
    total_stats = {'success': 0, 'errors': 0, 'skipped': 0}

    # Scrape each season
    for season in seasons:
        try:
            stats = scrape_team_season(team_name, season, scraper, loader)
            total_stats['success'] += stats['success']
            total_stats['errors'] += stats['errors']
            total_stats['skipped'] += stats['skipped']
        except Exception as e:
            logger.error(f"Failed to scrape {season} season: {e}")
            continue

    # Final summary
    logger.info("\n" + "="*60)
    logger.info("FINAL BACKFILL SUMMARY")
    logger.info("="*60)
    logger.info(f"Team: {team_name}")
    logger.info(f"Seasons: {', '.join(seasons)}")
    logger.info(f"✓ Total Success: {total_stats['success']}")
    logger.info(f"✗ Total Errors: {total_stats['errors']}")
    logger.info(f"⏭ Total Skipped: {total_stats['skipped']}")
    logger.info("\nBackfill complete!")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("\nBackfill interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)
