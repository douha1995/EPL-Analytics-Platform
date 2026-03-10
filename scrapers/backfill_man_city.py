"""
Manchester City Backfill Script - Quick script to scrape Man City data

Usage:
    python backfill_man_city.py
"""

import logging
import sys
import subprocess

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

def main():
    """Run Manchester City backfill for 2025-26 and 2024-25 seasons"""
    team_name = "Manchester_City"
    seasons = "2025,2024"  # 2025-26 and 2024-25 seasons

    logger.info("="*60)
    logger.info("MANCHESTER CITY BACKFILL")
    logger.info("Seasons: 2025-26, 2024-25")
    logger.info("="*60)

    # Run the generic backfill script
    cmd = [
        sys.executable,
        "backfill_team.py",
        "--team", team_name,
        "--seasons", seasons
    ]

    logger.info(f"Running: {' '.join(cmd)}")

    try:
        result = subprocess.run(cmd, check=True)
        logger.info("\n✓ Manchester City backfill completed successfully!")
        return result.returncode
    except subprocess.CalledProcessError as e:
        logger.error(f"\n✗ Manchester City backfill failed with exit code {e.returncode}")
        return e.returncode
    except Exception as e:
        logger.error(f"\n✗ Error running backfill: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
