"""
Liverpool Backfill Script - Quick script to scrape Liverpool data

Usage:
    python backfill_liverpool.py
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
    """Run Liverpool backfill for 2025-26 and 2024-25 seasons"""
    team_name = "Liverpool"
    seasons = "2025,2024"  # 2025-26 and 2024-25 seasons

    logger.info("="*60)
    logger.info("LIVERPOOL BACKFILL")
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
        logger.info("\n✓ Liverpool backfill completed successfully!")
        return result.returncode
    except subprocess.CalledProcessError as e:
        logger.error(f"\n✗ Liverpool backfill failed with exit code {e.returncode}")
        return e.returncode
    except Exception as e:
        logger.error(f"\n✗ Error running backfill: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
