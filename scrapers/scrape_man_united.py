#!/usr/bin/env python3
"""
Scrape Manchester United data using Playwright and load into database

This script:
1. Scrapes Man United fixtures for 2024 and 2025 seasons using Playwright
2. For each fixture, scrapes detailed shot data
3. Loads data into PostgreSQL database
"""

import logging
import sys
import time
from typing import List, Dict, Any
import psycopg2
from psycopg2.extras import Json
from datetime import datetime

from playwright_scraper import UnderstatPlaywrightScraper
from config import config
from utils import generate_match_id

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def get_db_connection():
    """Create database connection"""
    # Use localhost since we're running outside Docker
    db_host = 'localhost' if config.DB_HOST == 'postgres' else config.DB_HOST

    return psycopg2.connect(
        host=db_host,
        port=config.DB_PORT,
        dbname=config.DB_NAME,
        user=config.DB_USER,
        password=config.DB_PASSWORD
    )


def insert_match_reference(conn, fixture: Dict[str, Any]):
    """Insert match into bronze.match_reference table"""
    cursor = conn.cursor()

    try:
        # Determine season from match date (e.g., "2024-08-17" -> "2024-25")
        if fixture.get('match_date'):
            year = int(fixture['match_date'].split('-')[0])
            month = int(fixture['match_date'].split('-')[1])

            # If month >= 7 (July onwards), it's the start of the season
            if month >= 7:
                season = f"{year}-{str(year + 1)[-2:]}"
            else:
                season = f"{year - 1}-{str(year)[-2:]}"
        else:
            season = "2024-25"  # Default

        cursor.execute("""
            INSERT INTO bronze.match_reference
            (match_url, match_date, home_team, away_team, season, team_name)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (match_url) DO UPDATE SET
                match_date = EXCLUDED.match_date,
                home_team = EXCLUDED.home_team,
                away_team = EXCLUDED.away_team,
                season = EXCLUDED.season,
                team_name = EXCLUDED.team_name
        """, (
            fixture['match_url'],
            fixture.get('match_date'),
            fixture['home_team'],
            fixture['away_team'],
            season,
            fixture.get('team_name', 'Manchester_United')
        ))

        conn.commit()
        logger.info(f"✓ Inserted match reference: {fixture['home_team']} vs {fixture['away_team']}")

    except Exception as e:
        conn.rollback()
        logger.error(f"✗ Error inserting match reference: {e}")
        raise
    finally:
        cursor.close()


def insert_match_shots(conn, match_data: Dict[str, Any]):
    """Insert match shots into bronze.understat_raw table"""
    cursor = conn.cursor()

    try:
        # Generate match_id
        match_id = match_data.get('match_id') or generate_match_id(
            match_data['home_team'],
            match_data['away_team'],
            match_data.get('match_date', '')
        )

        # Determine which team this data belongs to
        # If Man United is home team or away team
        home_team = match_data.get('home_team', '')
        away_team = match_data.get('away_team', '')

        if 'Manchester United' in home_team or 'Manchester United' in away_team:
            team_name = 'Manchester_United'
        else:
            team_name = 'Arsenal'  # Fallback

        # Prepare shots JSON
        shots_json = {
            'shots': match_data.get('shots', [])
        }

        cursor.execute("""
            INSERT INTO bronze.understat_raw
            (match_id, match_url, raw_shots, team_name, scraped_at, scrape_run_id)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (match_id) DO UPDATE SET
                raw_shots = EXCLUDED.raw_shots,
                updated_at = CURRENT_TIMESTAMP
        """, (
            match_id,
            match_data['match_url'],
            Json(shots_json),
            team_name,
            datetime.utcnow(),
            f"manual_scrape_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
        ))

        conn.commit()
        logger.info(f"✓ Inserted {len(match_data.get('shots', []))} shots for {match_data['home_team']} vs {match_data['away_team']}")

    except Exception as e:
        conn.rollback()
        logger.error(f"✗ Error inserting match shots: {e}")
        raise
    finally:
        cursor.close()


def scrape_and_load_team_season(team_name: str, season: str, load_to_db: bool = True):
    """
    Scrape a team's season and optionally load to database

    Args:
        team_name: Team name (e.g., "Manchester_United")
        season: Season year (e.g., "2024" for 2024-25)
        load_to_db: Whether to load data into database
    """
    logger.info(f"\n{'='*60}")
    logger.info(f"Starting scrape: {team_name} - Season {season}")
    logger.info(f"{'='*60}\n")

    scraper = UnderstatPlaywrightScraper()

    # Step 1: Scrape fixtures
    logger.info(f"Step 1: Scraping fixtures for {team_name} {season} season...")
    fixtures = scraper.scrape_season_fixtures(season=season, team_name=team_name)

    logger.info(f"✓ Found {len(fixtures)} fixtures")

    if len(fixtures) == 0:
        logger.warning(f"No fixtures found for {team_name} in {season}")
        return

    # Step 2: Filter for played matches
    played_matches = [f for f in fixtures if f.get('is_result', False)]
    logger.info(f"✓ {len(played_matches)} matches have been played")

    if len(played_matches) == 0:
        logger.warning(f"No completed matches found for {team_name} in {season}")
        return

    # Step 3: Load to database if requested
    if load_to_db:
        conn = get_db_connection()

        try:
            # Insert all match references
            logger.info(f"\nStep 2: Loading match references to database...")
            for fixture in fixtures:
                insert_match_reference(conn, fixture)

            # Scrape and insert match shots
            logger.info(f"\nStep 3: Scraping and loading match shots...")
            for idx, fixture in enumerate(played_matches, 1):
                logger.info(f"\n[{idx}/{len(played_matches)}] Processing: {fixture['home_team']} vs {fixture['away_team']}")

                try:
                    # Scrape match shots
                    match_data = scraper.scrape_match_shots(
                        fixture['match_url'],
                        home_team=fixture['home_team'],
                        away_team=fixture['away_team'],
                        match_date=fixture['match_date']
                    )

                    # Insert to database
                    insert_match_shots(conn, match_data)

                    # Rate limiting
                    if idx < len(played_matches):
                        logger.info("Waiting 3 seconds before next request...")
                        time.sleep(3)

                except Exception as e:
                    logger.error(f"✗ Failed to process match: {e}")
                    continue

            logger.info(f"\n{'='*60}")
            logger.info(f"✅ COMPLETE: {team_name} - Season {season}")
            logger.info(f"{'='*60}\n")

        finally:
            conn.close()

    else:
        # Just show what would be scraped
        logger.info(f"\nDry run - would scrape {len(played_matches)} matches:")
        for fixture in played_matches[:5]:  # Show first 5
            logger.info(f"  - {fixture['home_team']} vs {fixture['away_team']} ({fixture['match_date']})")
        if len(played_matches) > 5:
            logger.info(f"  ... and {len(played_matches) - 5} more")


def main():
    """Main execution"""
    logger.info("Manchester United Data Scraper - Using Playwright\n")

    teams_to_scrape = [
        ("Manchester_United", "2024"),  # 2024-25 season
        ("Manchester_United", "2023"),  # 2023-24 season
    ]

    for team_name, season in teams_to_scrape:
        try:
            scrape_and_load_team_season(team_name, season, load_to_db=True)
        except Exception as e:
            logger.error(f"Failed to scrape {team_name} {season}: {e}")
            continue

    # Verify data loaded
    logger.info("\n" + "="*60)
    logger.info("Verifying data in database...")
    logger.info("="*60)

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT team_name, COUNT(*) as match_count
            FROM bronze.understat_raw
            WHERE team_name IS NOT NULL
            GROUP BY team_name
            ORDER BY team_name
        """)

        results = cursor.fetchall()

        logger.info("\n📊 Database Summary:")
        for team_name, count in results:
            logger.info(f"  {team_name}: {count} matches")

        cursor.close()
        conn.close()

        logger.info("\n✅ Scraping and loading complete!")

    except Exception as e:
        logger.error(f"Error verifying data: {e}")


if __name__ == "__main__":
    main()
