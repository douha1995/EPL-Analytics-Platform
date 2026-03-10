#!/usr/bin/env python3
"""
Data Validation Script for EPL Analytics Platform

This script validates the accuracy and completeness of scraped data.
Run from scrapers directory: python validate_data.py

Usage:
    python validate_data.py                    # Run all validations
    python validate_data.py --team Arsenal     # Validate specific team
    python validate_data.py --season 2025-26   # Validate specific season
    python validate_data.py --verbose          # Show detailed output
"""

import argparse
import logging
import os
import sys
from typing import Dict, List, Any, Tuple
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class DataValidator:
    def __init__(self):
        self.conn_params = {
            'host': os.getenv('POSTGRES_HOST', 'localhost'),
            'port': os.getenv('POSTGRES_PORT', '5432'),
            'database': os.getenv('POSTGRES_DB', 'arsenalfc_analytics'),
            'user': os.getenv('POSTGRES_USER', 'analytics_user'),
            'password': os.getenv('POSTGRES_PASSWORD', 'analytics_pass')
        }
        self.errors = []
        self.warnings = []
        self.stats = {}

    def get_connection(self):
        return psycopg2.connect(**self.conn_params)

    def run_all_validations(self, team: str = None, season: str = None, verbose: bool = False) -> Dict[str, Any]:
        """Run all validation checks"""
        logger.info("="*60)
        logger.info("EPL ANALYTICS PLATFORM - DATA VALIDATION")
        logger.info("="*60)

        results = {
            'timestamp': datetime.now().isoformat(),
            'team_filter': team,
            'season_filter': season,
            'checks': []
        }

        # 1. Match counts validation
        results['checks'].append(self.validate_match_counts(team, season))

        # 2. Shot data completeness
        results['checks'].append(self.validate_shot_completeness(team, season))

        # 3. xG range validation
        results['checks'].append(self.validate_xg_range())

        # 4. Player name consistency
        results['checks'].append(self.validate_player_names(team))

        # 5. Duplicate detection
        results['checks'].append(self.validate_no_duplicates())

        # 6. Date consistency
        results['checks'].append(self.validate_date_consistency())

        # 7. Team name consistency
        results['checks'].append(self.validate_team_names())

        # Summary
        total_errors = sum(c['errors'] for c in results['checks'])
        total_warnings = sum(c['warnings'] for c in results['checks'])

        logger.info("\n" + "="*60)
        logger.info("VALIDATION SUMMARY")
        logger.info("="*60)
        logger.info(f"Total Checks: {len(results['checks'])}")
        logger.info(f"Passed: {sum(1 for c in results['checks'] if c['status'] == 'PASS')}")
        logger.info(f"Warnings: {total_warnings}")
        logger.info(f"Errors: {total_errors}")

        results['summary'] = {
            'total_checks': len(results['checks']),
            'passed': sum(1 for c in results['checks'] if c['status'] == 'PASS'),
            'warnings': total_warnings,
            'errors': total_errors,
            'status': 'PASS' if total_errors == 0 else 'FAIL'
        }

        return results

    def validate_match_counts(self, team: str = None, season: str = None) -> Dict:
        """Validate match counts per team/season"""
        logger.info("\n[1] Validating Match Counts...")

        result = {'name': 'match_counts', 'errors': 0, 'warnings': 0, 'details': []}

        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                query = """
                    SELECT 
                        team_name,
                        season,
                        COUNT(*) as match_count,
                        COUNT(DISTINCT match_url) as unique_matches
                    FROM metrics.team_matches
                    WHERE 1=1
                """
                params = []
                if team:
                    query += " AND team_name = %s"
                    params.append(team)
                if season:
                    query += " AND season = %s"
                    params.append(season)

                query += " GROUP BY team_name, season ORDER BY team_name, season DESC"

                cur.execute(query, params if params else None)
                rows = cur.fetchall()

                for row in rows:
                    team_name = row['team_name']
                    season_val = row['season']
                    count = row['match_count']

                    expected_range = (20, 42)  # EPL season: 20-42 matches
                    status = 'OK' if expected_range[0] <= count <= expected_range[1] else 'WARNING'

                    if count < expected_range[0]:
                        result['warnings'] += 1
                        logger.warning(f"  {team_name} {season_val}: {count} matches (below expected)")
                    else:
                        logger.info(f"  {team_name} {season_val}: {count} matches")

                    result['details'].append({
                        'team': team_name,
                        'season': season_val,
                        'count': count,
                        'status': status
                    })

        result['status'] = 'PASS' if result['errors'] == 0 else 'FAIL'
        return result

    def validate_shot_completeness(self, team: str = None, season: str = None) -> Dict:
        """Validate shot data exists for all matches"""
        logger.info("\n[2] Validating Shot Data Completeness...")

        result = {'name': 'shot_completeness', 'errors': 0, 'warnings': 0, 'details': []}

        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                query = """
                    SELECT 
                        m.team_name,
                        m.season,
                        COUNT(DISTINCT m.match_url) as total_matches,
                        COUNT(DISTINCT s.match_url) as matches_with_shots,
                        COUNT(s.xg) as total_shots,
                        ROUND(AVG(shots_per_match.shot_count)::numeric, 1) as avg_shots_per_match
                    FROM metrics.team_matches m
                    LEFT JOIN silver.shot_events s ON m.match_url = s.match_url AND m.team_name = s.team
                    LEFT JOIN LATERAL (
                        SELECT COUNT(*) as shot_count
                        FROM silver.shot_events
                        WHERE match_url = m.match_url AND team = m.team_name
                    ) shots_per_match ON true
                    WHERE 1=1
                """
                params = []
                if team:
                    query += " AND m.team_name = %s"
                    params.append(team)
                if season:
                    query += " AND m.season = %s"
                    params.append(season)

                query += " GROUP BY m.team_name, m.season ORDER BY m.team_name, m.season DESC"

                cur.execute(query, params if params else None)
                rows = cur.fetchall()

                for row in rows:
                    completeness = (row['matches_with_shots'] / row['total_matches'] * 100) if row['total_matches'] > 0 else 0
                    status = 'OK' if completeness >= 90 else 'WARNING' if completeness >= 70 else 'ERROR'

                    if completeness < 90:
                        result['warnings'] += 1
                        logger.warning(f"  {row['team_name']} {row['season']}: {completeness:.1f}% shot coverage ({row['matches_with_shots']}/{row['total_matches']})")
                    else:
                        logger.info(f"  {row['team_name']} {row['season']}: {completeness:.1f}% shot coverage, avg {row['avg_shots_per_match']} shots/match")

                    result['details'].append({
                        'team': row['team_name'],
                        'season': row['season'],
                        'completeness_pct': completeness,
                        'status': status
                    })

        result['status'] = 'PASS' if result['errors'] == 0 else 'FAIL'
        return result

    def validate_xg_range(self) -> Dict:
        """Validate xG values are in expected range (0-1)"""
        logger.info("\n[3] Validating xG Value Ranges...")

        result = {'name': 'xg_range', 'errors': 0, 'warnings': 0, 'details': []}

        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Check for xG values outside normal range
                cur.execute("""
                    SELECT 
                        COUNT(*) FILTER (WHERE xg < 0) as negative_xg,
                        COUNT(*) FILTER (WHERE xg > 1) as over_one_xg,
                        COUNT(*) FILTER (WHERE xg > 0.99) as near_perfect_chances,
                        MIN(xg) as min_xg,
                        MAX(xg) as max_xg,
                        ROUND(AVG(xg)::numeric, 4) as avg_xg,
                        COUNT(*) as total_shots
                    FROM silver.shot_events
                """)

                row = cur.fetchone()

                if row['negative_xg'] > 0:
                    result['errors'] += 1
                    logger.error(f"  Found {row['negative_xg']} shots with negative xG!")

                if row['over_one_xg'] > 0:
                    result['warnings'] += 1
                    logger.warning(f"  Found {row['over_one_xg']} shots with xG > 1 (penalties?)")

                logger.info(f"  xG Range: {row['min_xg']:.4f} to {row['max_xg']:.4f}")
                logger.info(f"  Average xG: {row['avg_xg']}")
                logger.info(f"  Total Shots: {row['total_shots']}")

                result['details'] = {
                    'min_xg': float(row['min_xg']) if row['min_xg'] else 0,
                    'max_xg': float(row['max_xg']) if row['max_xg'] else 0,
                    'avg_xg': float(row['avg_xg']) if row['avg_xg'] else 0,
                    'total_shots': row['total_shots']
                }

        result['status'] = 'PASS' if result['errors'] == 0 else 'FAIL'
        return result

    def validate_player_names(self, team: str = None) -> Dict:
        """Check for unusual player names"""
        logger.info("\n[4] Validating Player Names...")

        result = {'name': 'player_names', 'errors': 0, 'warnings': 0, 'details': []}

        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                query = """
                    SELECT 
                        player_name,
                        team,
                        COUNT(*) as shot_count
                    FROM silver.shot_events
                    WHERE player_name IS NULL 
                       OR player_name = '' 
                       OR LENGTH(player_name) < 2
                       OR player_name ~ '^[0-9]+$'
                """
                if team:
                    query += " AND team = %s"

                query += " GROUP BY player_name, team"

                cur.execute(query, (team,) if team else None)
                rows = cur.fetchall()

                if rows:
                    result['warnings'] += len(rows)
                    for row in rows:
                        logger.warning(f"  Suspicious player name: '{row['player_name']}' ({row['team']}, {row['shot_count']} shots)")
                        result['details'].append({
                            'player_name': row['player_name'],
                            'team': row['team'],
                            'shot_count': row['shot_count']
                        })
                else:
                    logger.info("  All player names look valid")

        result['status'] = 'PASS' if result['errors'] == 0 else 'FAIL'
        return result

    def validate_no_duplicates(self) -> Dict:
        """Check for duplicate match entries"""
        logger.info("\n[5] Checking for Duplicates...")

        result = {'name': 'duplicates', 'errors': 0, 'warnings': 0, 'details': []}

        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Check match_reference duplicates
                cur.execute("""
                    SELECT match_url, team_name, COUNT(*) as count
                    FROM bronze.match_reference
                    GROUP BY match_url, team_name
                    HAVING COUNT(*) > 1
                """)
                duplicates = cur.fetchall()

                if duplicates:
                    result['warnings'] += len(duplicates)
                    for dup in duplicates:
                        logger.warning(f"  Duplicate match_reference: {dup['match_url']} ({dup['team_name']})")
                else:
                    logger.info("  No duplicate matches found in match_reference")

                # Check understat_raw duplicates
                cur.execute("""
                    SELECT match_url, team_name, COUNT(*) as count
                    FROM bronze.understat_raw
                    GROUP BY match_url, team_name
                    HAVING COUNT(*) > 1
                    LIMIT 10
                """)
                duplicates = cur.fetchall()

                if duplicates:
                    result['warnings'] += len(duplicates)
                    for dup in duplicates:
                        logger.warning(f"  Duplicate understat_raw: {dup['match_url']} ({dup['team_name']})")
                else:
                    logger.info("  No duplicate matches found in understat_raw")

        result['status'] = 'PASS' if result['errors'] == 0 else 'FAIL'
        return result

    def validate_date_consistency(self) -> Dict:
        """Check date consistency between tables"""
        logger.info("\n[6] Validating Date Consistency...")

        result = {'name': 'date_consistency', 'errors': 0, 'warnings': 0, 'details': []}

        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Check for future dates
                cur.execute("""
                    SELECT COUNT(*) as future_matches
                    FROM bronze.match_reference
                    WHERE match_date > CURRENT_DATE
                """)
                row = cur.fetchone()

                if row['future_matches'] > 0:
                    result['warnings'] += 1
                    logger.warning(f"  Found {row['future_matches']} matches with future dates")
                else:
                    logger.info("  No future-dated matches found")

                # Check date range
                cur.execute("""
                    SELECT 
                        MIN(match_date) as earliest,
                        MAX(match_date) as latest,
                        COUNT(DISTINCT match_date) as unique_dates
                    FROM bronze.match_reference
                """)
                row = cur.fetchone()

                logger.info(f"  Date range: {row['earliest']} to {row['latest']}")
                logger.info(f"  Unique match dates: {row['unique_dates']}")

                result['details'] = {
                    'earliest': str(row['earliest']),
                    'latest': str(row['latest']),
                    'unique_dates': row['unique_dates']
                }

        result['status'] = 'PASS' if result['errors'] == 0 else 'FAIL'
        return result

    def validate_team_names(self) -> Dict:
        """Validate team name consistency"""
        logger.info("\n[7] Validating Team Name Consistency...")

        result = {'name': 'team_names', 'errors': 0, 'warnings': 0, 'details': []}

        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # List all unique teams
                cur.execute("""
                    SELECT DISTINCT team_name, COUNT(*) as matches
                    FROM bronze.match_reference
                    WHERE team_name IS NOT NULL
                    GROUP BY team_name
                    ORDER BY matches DESC
                """)
                teams = cur.fetchall()

                logger.info(f"  Found {len(teams)} teams in database:")
                for team in teams:
                    logger.info(f"    - {team['team_name']}: {team['matches']} matches")

                # Check for team names with underscores (should use spaces)
                cur.execute("""
                    SELECT DISTINCT team_name
                    FROM bronze.match_reference
                    WHERE team_name LIKE '%\\_%'
                """)
                underscore_teams = cur.fetchall()

                if underscore_teams:
                    result['warnings'] += len(underscore_teams)
                    for team in underscore_teams:
                        logger.warning(f"  Team name with underscore: '{team['team_name']}' (should use spaces)")

                result['details'] = [{'team': t['team_name'], 'matches': t['matches']} for t in teams]

        result['status'] = 'PASS' if result['errors'] == 0 else 'FAIL'
        return result


def main():
    parser = argparse.ArgumentParser(description='Validate EPL Analytics Platform data')
    parser.add_argument('--team', help='Filter by team name')
    parser.add_argument('--season', help='Filter by season (e.g., 2025-26)')
    parser.add_argument('--verbose', '-v', action='store_true', help='Show detailed output')

    args = parser.parse_args()

    validator = DataValidator()

    try:
        results = validator.run_all_validations(
            team=args.team,
            season=args.season,
            verbose=args.verbose
        )

        if results['summary']['status'] == 'PASS':
            logger.info("\n*** VALIDATION PASSED ***")
            sys.exit(0)
        else:
            logger.error("\n*** VALIDATION FAILED ***")
            sys.exit(1)

    except Exception as e:
        logger.error(f"Validation failed with error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
