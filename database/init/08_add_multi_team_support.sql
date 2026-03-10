-- Migration: Add multi-team support to existing database
-- This script adds team_name columns and updates views for EPL platform

\c arsenalfc_analytics

-- ============================================================================
-- STEP 1: Add team_name columns to Bronze layer
-- ============================================================================

-- Add team_name to match_reference (primary source of truth)
ALTER TABLE bronze.match_reference
ADD COLUMN IF NOT EXISTS team_name VARCHAR(100);

-- Update existing Arsenal matches
UPDATE bronze.match_reference
SET team_name = 'Arsenal'
WHERE team_name IS NULL
  AND (home_team = 'Arsenal' OR away_team = 'Arsenal');

-- Add team_name to understat_raw for tracking
ALTER TABLE bronze.understat_raw
ADD COLUMN IF NOT EXISTS team_name VARCHAR(100);

-- Update existing understat data
UPDATE bronze.understat_raw u
SET team_name = 'Arsenal'
WHERE team_name IS NULL
  AND EXISTS (
    SELECT 1 FROM bronze.match_reference m
    WHERE m.match_url = u.match_url
    AND (m.home_team = 'Arsenal' OR m.away_team = 'Arsenal')
  );

-- Add team_name to fbref_raw
ALTER TABLE bronze.fbref_raw
ADD COLUMN IF NOT EXISTS team_name VARCHAR(100) DEFAULT 'Arsenal';

-- Add team_name to fbref_lineups
ALTER TABLE bronze.fbref_lineups
ADD COLUMN IF NOT EXISTS team_name VARCHAR(100) DEFAULT 'Arsenal';

-- Create indexes for team filtering
CREATE INDEX IF NOT EXISTS idx_match_reference_team ON bronze.match_reference(team_name);
CREATE INDEX IF NOT EXISTS idx_understat_raw_team ON bronze.understat_raw(team_name);
CREATE INDEX IF NOT EXISTS idx_fbref_raw_team ON bronze.fbref_raw(team_name);
CREATE INDEX IF NOT EXISTS idx_fbref_lineups_team ON bronze.fbref_lineups(team_name);

-- ============================================================================
-- STEP 2: Create team-agnostic views (replacing Arsenal-specific ones)
-- ============================================================================

-- Drop old Arsenal-specific views
DROP VIEW IF EXISTS metrics.arsenal_matches CASCADE;
DROP VIEW IF EXISTS metrics.arsenal_player_stats CASCADE;

-- Create generic team_matches view
CREATE OR REPLACE VIEW metrics.team_matches AS
WITH match_base AS (
    SELECT DISTINCT
        ref.team_name,
        ref.match_url,
        ref.match_date,
        ref.home_team,
        ref.away_team,
        ref.season,

        (r.raw_shots->>'home_goals')::INTEGER AS home_goals,
        (r.raw_shots->>'away_goals')::INTEGER AS away_goals,
        (r.raw_shots->>'home_xg')::DECIMAL(5,2) AS home_xg,
        (r.raw_shots->>'away_xg')::DECIMAL(5,2) AS away_xg,

        -- Team-specific columns (dynamic based on home/away)
        CASE
            WHEN ref.home_team = ref.team_name THEN 'H'
            WHEN ref.away_team = ref.team_name THEN 'A'
        END AS venue,

        CASE
            WHEN ref.home_team = ref.team_name THEN ref.away_team
            ELSE ref.home_team
        END AS opponent

    FROM bronze.understat_raw r
    INNER JOIN bronze.match_reference ref ON r.match_url = ref.match_url
    WHERE ref.team_name IS NOT NULL
      AND (ref.home_team = ref.team_name OR ref.away_team = ref.team_name)
)
SELECT
    team_name,
    match_url,
    match_date,
    season,
    opponent,
    venue,

    -- Team stats
    CASE WHEN venue = 'H' THEN home_goals ELSE away_goals END AS team_goals,
    CASE WHEN venue = 'A' THEN home_goals ELSE away_goals END AS opponent_goals,

    CASE WHEN venue = 'H' THEN home_xg ELSE away_xg END AS team_xg,
    CASE WHEN venue = 'A' THEN home_xg ELSE away_xg END AS opponent_xg,

    -- Match result
    CASE
        WHEN (venue = 'H' AND home_goals > away_goals) OR (venue = 'A' AND away_goals > home_goals) THEN 'W'
        WHEN home_goals = away_goals THEN 'D'
        ELSE 'L'
    END AS result,

    -- xG performance (actual goals minus expected)
    CASE
        WHEN venue = 'H' THEN (home_goals - home_xg)
        ELSE (away_goals - away_xg)
    END AS xg_overperformance

FROM match_base
ORDER BY team_name, match_date DESC;

-- Create backward-compatible Arsenal view
CREATE OR REPLACE VIEW metrics.arsenal_matches AS
SELECT
    match_url,
    match_date,
    season,
    opponent,
    venue,
    team_goals AS arsenal_goals,
    opponent_goals,
    team_xg AS arsenal_xg,
    opponent_xg,
    result,
    xg_overperformance
FROM metrics.team_matches
WHERE team_name = 'Arsenal';

-- Create generic player stats view
CREATE OR REPLACE VIEW metrics.player_stats AS
SELECT
    s.player_name,
    m.team_name,
    s.season,
    s.position_category,

    COUNT(*) FILTER (WHERE s.result = 'Goal') AS goals,
    COUNT(*) AS shots,
    SUM(s.xg) AS total_xg,
    ROUND(AVG(s.xg), 4) AS avg_xg_per_shot,

    -- Shot types
    COUNT(*) FILTER (WHERE s.shot_type = 'RightFoot') AS right_foot_shots,
    COUNT(*) FILTER (WHERE s.shot_type = 'LeftFoot') AS left_foot_shots,
    COUNT(*) FILTER (WHERE s.shot_type = 'Head') AS headed_shots,

    -- Situations
    COUNT(*) FILTER (WHERE s.situation = 'OpenPlay') AS open_play_shots,
    COUNT(*) FILTER (WHERE s.situation = 'SetPiece') AS set_piece_shots,
    COUNT(*) FILTER (WHERE s.situation = 'FromCorner') AS corner_shots,

    -- Conversion rate
    ROUND(
        COUNT(*) FILTER (WHERE s.result = 'Goal')::DECIMAL / NULLIF(COUNT(*), 0) * 100,
        2
    ) AS conversion_rate_pct,

    -- xG overperformance
    ROUND(
        COUNT(*) FILTER (WHERE s.result = 'Goal')::DECIMAL - SUM(s.xg),
        2
    ) AS goals_above_xg,

    COUNT(DISTINCT s.match_url) AS matches_played

FROM silver.shot_events s
INNER JOIN bronze.match_reference m ON s.match_url = m.match_url
WHERE s.team = m.team_name  -- Only count shots for the team in question
GROUP BY s.player_name, m.team_name, s.season, s.position_category
ORDER BY m.team_name, total_xg DESC;

-- Create backward-compatible Arsenal player stats
CREATE OR REPLACE VIEW metrics.arsenal_player_stats AS
SELECT
    player_name,
    season,
    position_category,
    goals,
    shots,
    total_xg,
    avg_xg_per_shot,
    right_foot_shots,
    left_foot_shots,
    headed_shots,
    open_play_shots,
    set_piece_shots,
    corner_shots,
    conversion_rate_pct,
    goals_above_xg,
    matches_played
FROM metrics.player_stats
WHERE team_name = 'Arsenal';

-- ============================================================================
-- STEP 3: Update season_summary view for multi-team
-- ============================================================================

DROP VIEW IF EXISTS metrics.season_summary CASCADE;

CREATE OR REPLACE VIEW metrics.season_summary AS
SELECT
    team_name,
    season,
    COUNT(*) AS matches_played,
    SUM(CASE WHEN result = 'W' THEN 1 ELSE 0 END) AS wins,
    SUM(CASE WHEN result = 'D' THEN 1 ELSE 0 END) AS draws,
    SUM(CASE WHEN result = 'L' THEN 1 ELSE 0 END) AS losses,

    -- Points (3 for win, 1 for draw)
    (SUM(CASE WHEN result = 'W' THEN 3 WHEN result = 'D' THEN 1 ELSE 0 END))::INTEGER AS points,

    -- Goals
    SUM(team_goals)::INTEGER AS goals_for,
    SUM(opponent_goals)::INTEGER AS goals_against,
    (SUM(team_goals) - SUM(opponent_goals))::INTEGER AS goal_difference,

    -- xG metrics
    ROUND(SUM(team_xg), 2) AS total_xg_for,
    ROUND(SUM(opponent_xg), 2) AS total_xg_against,
    ROUND(AVG(team_xg), 2) AS avg_xg_per_match,
    ROUND(SUM(team_goals) - SUM(team_xg), 2) AS total_xg_overperformance,

    -- Home/Away splits
    COUNT(*) FILTER (WHERE venue = 'H') AS home_matches,
    COUNT(*) FILTER (WHERE venue = 'A') AS away_matches,
    SUM(CASE WHEN venue = 'H' AND result = 'W' THEN 1 ELSE 0 END) AS home_wins,
    SUM(CASE WHEN venue = 'A' AND result = 'W' THEN 1 ELSE 0 END) AS away_wins,

    -- Win percentage
    ROUND(
        SUM(CASE WHEN result = 'W' THEN 1 ELSE 0 END)::DECIMAL / NULLIF(COUNT(*), 0) * 100,
        1
    ) AS win_percentage

FROM metrics.team_matches
GROUP BY team_name, season
ORDER BY team_name, season DESC;

-- ============================================================================
-- STEP 4: Create EPL-specific views
-- ============================================================================

-- EPL League Table view
CREATE OR REPLACE VIEW metrics.epl_standings AS
WITH team_stats AS (
    SELECT
        team_name,
        season,
        COUNT(*) AS played,
        SUM(CASE WHEN result = 'W' THEN 1 ELSE 0 END) AS won,
        SUM(CASE WHEN result = 'D' THEN 1 ELSE 0 END) AS drawn,
        SUM(CASE WHEN result = 'L' THEN 1 ELSE 0 END) AS lost,
        SUM(team_goals) AS goals_for,
        SUM(opponent_goals) AS goals_against,
        (SUM(team_goals) - SUM(opponent_goals)) AS goal_difference,
        SUM(CASE WHEN result = 'W' THEN 3 WHEN result = 'D' THEN 1 ELSE 0 END) AS points
    FROM metrics.team_matches
    GROUP BY team_name, season
)
SELECT
    ROW_NUMBER() OVER (PARTITION BY season ORDER BY points DESC, goal_difference DESC, goals_for DESC) AS position,
    team_name,
    season,
    played,
    won,
    drawn,
    lost,
    goals_for,
    goals_against,
    goal_difference,
    points
FROM team_stats
ORDER BY season DESC, position ASC;

-- Team vs Team head-to-head view
CREATE OR REPLACE VIEW metrics.head_to_head AS
SELECT
    tm1.team_name AS team_1,
    tm2.team_name AS team_2,
    tm1.season,

    -- Team 1 stats
    COUNT(*) AS matches_played,
    SUM(CASE WHEN tm1.result = 'W' THEN 1 ELSE 0 END) AS team_1_wins,
    SUM(CASE WHEN tm1.result = 'D' THEN 1 ELSE 0 END) AS draws,
    SUM(CASE WHEN tm1.result = 'L' THEN 1 ELSE 0 END) AS team_2_wins,

    SUM(tm1.team_goals) AS team_1_goals,
    SUM(tm1.opponent_goals) AS team_2_goals,

    ROUND(AVG(tm1.team_xg), 2) AS team_1_avg_xg,
    ROUND(AVG(tm1.opponent_xg), 2) AS team_2_avg_xg

FROM metrics.team_matches tm1
INNER JOIN metrics.team_matches tm2
    ON tm1.match_url = tm2.match_url
    AND tm1.team_name != tm2.team_name
WHERE tm1.team_name < tm2.team_name  -- Avoid duplicate pairs
GROUP BY tm1.team_name, tm2.team_name, tm1.season
ORDER BY tm1.season DESC, tm1.team_name, tm2.team_name;

-- ============================================================================
-- STEP 5: Create helper function to get available teams
-- ============================================================================

CREATE OR REPLACE FUNCTION metrics.get_available_teams()
RETURNS TABLE(team_name VARCHAR, seasons_count INTEGER, total_matches INTEGER) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.team_name::VARCHAR,
        COUNT(DISTINCT t.season)::INTEGER AS seasons_count,
        COUNT(*)::INTEGER AS total_matches
    FROM metrics.team_matches t
    GROUP BY t.team_name
    ORDER BY total_matches DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 6: Grant permissions
-- ============================================================================

GRANT ALL ON ALL TABLES IN SCHEMA metrics TO analytics_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA metrics TO analytics_user;

-- Create comment for documentation
COMMENT ON VIEW metrics.team_matches IS 'Generic team matches view supporting all EPL teams';
COMMENT ON VIEW metrics.epl_standings IS 'EPL league table with positions, points, and goal difference';
COMMENT ON VIEW metrics.head_to_head IS 'Head-to-head statistics between any two teams';
COMMENT ON FUNCTION metrics.get_available_teams() IS 'Returns list of teams with data in the database';
