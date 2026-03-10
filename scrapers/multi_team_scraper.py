"""
Multi-Team Scraper - Orchestrates scraping for multiple EPL teams

This module handles:
- Scraping multiple teams in sequence
- Team data aggregation
- Deduplication of shared matches
"""

import logging
from typing import List, Dict, Any
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

from understat_scraper import UnderstatScraper
from utils import ScraperException

logger = logging.getLogger(__name__)


class MultiTeamScraper:
    """
    Scraper for multiple EPL teams

    Supports scraping fixtures and match data for multiple teams simultaneously
    """

    # EPL teams available on Understat
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
        "Bournemouth"
    ]

    def __init__(self, teams: List[str] = None):
        """
        Initialize multi-team scraper

        Args:
            teams: List of team names to scrape (defaults to Arsenal, Man Utd, Man City, Liverpool)
        """
        self.scraper = UnderstatScraper()
        self.teams = teams or ["Arsenal", "Manchester_United", "Manchester_City", "Liverpool"]

        # Validate teams
        invalid_teams = [t for t in self.teams if t not in self.SUPPORTED_TEAMS]
        if invalid_teams:
            logger.warning(f"Unsupported teams: {invalid_teams}")
            self.teams = [t for t in self.teams if t in self.SUPPORTED_TEAMS]

    def scrape_all_teams_fixtures(
        self,
        season: str = "2024",
        parallel: bool = False
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Scrape fixtures for all configured teams

        Args:
            season: Season year (e.g., "2024" for 2024-2025)
            parallel: Whether to scrape teams in parallel (faster but more requests)

        Returns:
            Dictionary mapping team names to fixture lists
        """
        logger.info(f"Scraping fixtures for {len(self.teams)} teams: {', '.join(self.teams)}")

        results = {}

        if parallel:
            # Parallel scraping (use with caution - respect rate limits)
            with ThreadPoolExecutor(max_workers=3) as executor:
                future_to_team = {
                    executor.submit(
                        self.scraper.scrape_season_fixtures,
                        season,
                        team
                    ): team
                    for team in self.teams
                }

                for future in as_completed(future_to_team):
                    team = future_to_team[future]
                    try:
                        fixtures = future.result()
                        results[team] = fixtures
                        logger.info(f"✓ {team}: {len(fixtures)} fixtures")
                    except Exception as e:
                        logger.error(f"✗ {team}: Failed - {e}")
                        results[team] = []
        else:
            # Sequential scraping (safer, respects rate limits)
            for team in self.teams:
                try:
                    fixtures = self.scraper.scrape_season_fixtures(
                        season=season,
                        team_name=team
                    )
                    results[team] = fixtures
                    logger.info(f"✓ {team}: {len(fixtures)} fixtures")
                except Exception as e:
                    logger.error(f"✗ {team}: Failed - {e}")
                    results[team] = []

        total_fixtures = sum(len(f) for f in results.values())
        logger.info(f"Scraped {total_fixtures} total fixtures across {len(self.teams)} teams")

        return results

    def deduplicate_matches(
        self,
        team_fixtures: Dict[str, List[Dict[str, Any]]]
    ) -> List[Dict[str, Any]]:
        """
        Deduplicate matches that appear in multiple team fixture lists

        When scraping multiple teams, the same match (e.g., Arsenal vs Man Utd)
        appears in both teams' fixture lists. This removes duplicates.

        Args:
            team_fixtures: Dictionary of team -> fixtures

        Returns:
            Deduplicated list of unique matches
        """
        unique_matches = {}

        for team, fixtures in team_fixtures.items():
            for fixture in fixtures:
                match_id = fixture.get('match_id')
                if match_id and match_id not in unique_matches:
                    # Add teams involved for reference
                    fixture['teams_involved'] = [team]
                    unique_matches[match_id] = fixture
                elif match_id:
                    # Match already exists, just add this team to the list
                    unique_matches[match_id]['teams_involved'].append(team)

        deduplicated = list(unique_matches.values())
        logger.info(f"Deduplicated to {len(deduplicated)} unique matches")

        return deduplicated

    def scrape_team_season(
        self,
        team_name: str,
        season: str = "2024"
    ) -> Dict[str, Any]:
        """
        Scrape complete season data for a single team

        Args:
            team_name: Team to scrape
            season: Season year

        Returns:
            Dictionary with fixtures and metadata
        """
        logger.info(f"Scraping {season} season for {team_name}")

        try:
            fixtures = self.scraper.scrape_season_fixtures(
                season=season,
                team_name=team_name
            )

            # Calculate statistics
            played = [f for f in fixtures if f.get('is_result')]
            upcoming = [f for f in fixtures if not f.get('is_result')]

            return {
                'team': team_name,
                'season': season,
                'fixtures': fixtures,
                'stats': {
                    'total_fixtures': len(fixtures),
                    'played': len(played),
                    'upcoming': len(upcoming)
                },
                'scraped_at': datetime.utcnow().isoformat()
            }

        except Exception as e:
            logger.error(f"Failed to scrape {team_name} season: {e}")
            raise ScraperException(f"Team season scrape failed: {e}")

    def get_match_details(
        self,
        match_url: str
    ) -> Dict[str, Any]:
        """
        Scrape detailed match data (shots, xG, etc.)

        Args:
            match_url: Understat match URL

        Returns:
            Match data dictionary
        """
        return self.scraper.scrape_match_shots(match_url)


def scrape_manchester_united(season: str = "2024") -> Dict[str, Any]:
    """
    Convenience function to scrape Manchester United season

    Args:
        season: "2024" or "2025" for current/last season

    Returns:
        Season data dictionary
    """
    scraper = MultiTeamScraper(teams=["Manchester_United"])
    return scraper.scrape_team_season("Manchester_United", season)


def scrape_multiple_epl_teams(
    teams: List[str],
    season: str = "2024"
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Scrape fixtures for multiple EPL teams

    Args:
        teams: List of team names (e.g., ["Arsenal", "Manchester_United"])
        season: Season year

    Returns:
        Dictionary mapping teams to their fixtures
    """
    scraper = MultiTeamScraper(teams=teams)
    return scraper.scrape_all_teams_fixtures(season=season)


if __name__ == "__main__":
    # Example usage: Scrape all 4 teams
    logging.basicConfig(level=logging.INFO)

    teams_to_scrape = ["Arsenal", "Manchester_United", "Manchester_City", "Liverpool"]

    scraper = MultiTeamScraper(teams=teams_to_scrape)

    # Scrape 2024-25 season
    current_season_fixtures = scraper.scrape_all_teams_fixtures(season="2024")

    # Scrape 2023-24 season
    last_season_fixtures = scraper.scrape_all_teams_fixtures(season="2023")

    # Deduplicate matches
    unique_current = scraper.deduplicate_matches(current_season_fixtures)
    unique_last = scraper.deduplicate_matches(last_season_fixtures)

    logger.info(f"Current season: {len(unique_current)} unique matches")
    logger.info(f"Last season: {len(unique_last)} unique matches")
