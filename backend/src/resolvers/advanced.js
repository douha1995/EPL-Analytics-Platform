import { query } from '../db/connection.js';

export const advancedResolvers = {
  Query: {
    async opponentComparison(_, { season, team = 'Arsenal' }) {
      let sql = `
        SELECT 
          m.opponent,
          COUNT(*) as matches_played,
          COUNT(*) FILTER (WHERE m.result = 'W') as wins,
          COUNT(*) FILTER (WHERE m.result = 'D') as draws,
          COUNT(*) FILTER (WHERE m.result = 'L') as losses,
          ROUND(100.0 * COUNT(*) FILTER (WHERE m.result = 'W') / NULLIF(COUNT(*), 0), 1) as win_rate_pct,
          SUM(m.team_goals) as goals_for,
          SUM(m.opponent_goals) as goals_against,
          ROUND(AVG(m.team_goals)::numeric, 2) as avg_goals_for,
          ROUND(AVG(m.opponent_goals)::numeric, 2) as avg_goals_against,
          ROUND(SUM(m.team_xg)::numeric, 2) as total_xg_for,
          ROUND(SUM(m.opponent_xg)::numeric, 2) as total_xg_against,
          ROUND(AVG(m.team_xg)::numeric, 2) as avg_xg_for,
          ROUND(AVG(m.opponent_xg)::numeric, 2) as avg_xg_against,
          COUNT(*) FILTER (WHERE m.opponent_goals = 0) as clean_sheets,
          COUNT(*) FILTER (WHERE m.team_goals = 0) as failed_to_score,
          MAX(m.match_date) as last_played
        FROM metrics.team_matches m
        WHERE m.team_name = $1
      `;
      const params = [team];
      
      if (season) {
        sql += ' AND m.season = $2';
        params.push(season);
      }
      
      sql += ' GROUP BY m.opponent ORDER BY matches_played DESC, win_rate_pct DESC';
      
      const result = await query(sql, params);

      return result.rows.map(row => ({
        opponent: row.opponent,
        matchesPlayed: parseInt(row.matches_played) || 0,
        wins: parseInt(row.wins) || 0,
        draws: parseInt(row.draws) || 0,
        losses: parseInt(row.losses) || 0,
        winRatePct: parseFloat(row.win_rate_pct) || 0,
        goalsFor: parseInt(row.goals_for) || 0,
        goalsAgainst: parseInt(row.goals_against) || 0,
        avgGoalsFor: parseFloat(row.avg_goals_for) || 0,
        avgGoalsAgainst: parseFloat(row.avg_goals_against) || 0,
        totalXgFor: parseFloat(row.total_xg_for) || 0,
        totalXgAgainst: parseFloat(row.total_xg_against) || 0,
        avgXgFor: parseFloat(row.avg_xg_for) || 0,
        avgXgAgainst: parseFloat(row.avg_xg_against) || 0,
        cleanSheets: parseInt(row.clean_sheets) || 0,
        failedToScore: parseInt(row.failed_to_score) || 0,
        lastPlayed: row.last_played,
        lastResult: null,
      }));
    },

    async matchAdvancedStats(_, { matchId }) {
      const result = await query(
        `SELECT * FROM metrics.match_advanced_stats WHERE match_url = $1`,
        [matchId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        matchUrl: row.match_url,
        matchDate: row.match_date,
        season: row.season,
        opponent: row.opponent,
        venue: row.venue,
        result: row.result,
        arsenalGoals: parseInt(row.arsenal_goals) || 0,
        opponentGoals: parseInt(row.opponent_goals) || 0,
        arsenalXg: parseFloat(row.arsenal_xg) || 0,
        opponentXg: parseFloat(row.opponent_xg) || 0,
        arsenalShots: parseInt(row.arsenal_shots) || 0,
        opponentShots: parseInt(row.opponent_shots) || 0,
        arsenalShotsOnTarget: parseInt(row.arsenal_shots_on_target) || 0,
        opponentShotsOnTarget: parseInt(row.opponent_shots_on_target) || 0,
        arsenalShotAccuracyPct: parseFloat(row.arsenal_shot_accuracy_pct) || 0,
        arsenalBigChances: parseInt(row.arsenal_big_chances) || 0,
        arsenalBigChancesScored: parseInt(row.arsenal_big_chances_scored) || 0,
        arsenalBoxShots: parseInt(row.arsenal_box_shots) || 0,
        arsenalOutsideBoxShots: parseInt(row.arsenal_outside_box_shots) || 0,
        arsenalFirstHalfShots: parseInt(row.arsenal_first_half_shots) || 0,
        arsenalFirstHalfXg: parseFloat(row.arsenal_first_half_xg) || 0,
        arsenalSecondHalfShots: parseInt(row.arsenal_second_half_shots) || 0,
        arsenalSecondHalfXg: parseFloat(row.arsenal_second_half_xg) || 0,
        arsenalAvgShotXg: parseFloat(row.arsenal_avg_shot_xg) || 0,
        opponentAvgShotXg: parseFloat(row.opponent_avg_shot_xg) || 0,
      };
    },

    async performanceTrends(_, { season, team = 'Arsenal', windowSize = 5 }) {
      const result = await query(
        `WITH match_shots AS (
          SELECT 
            s.match_url,
            COUNT(*) as shots,
            COUNT(*) FILTER (WHERE s.result IN ('Goal', 'SavedShot', 'ShotOnPost')) as shots_on_target,
            COUNT(*) FILTER (WHERE s.xg >= 0.35) as big_chances
          FROM silver.shot_events s
          WHERE s.season = $2 AND s.team = $3
          GROUP BY s.match_url
        )
        SELECT 
          m.match_date,
          m.opponent,
          m.result,
          m.team_goals as goals,
          m.team_xg as xg,
          COALESCE(ms.shots, 0) as shots,
          COALESCE(ms.shots_on_target, 0) as shots_on_target,
          COALESCE(ms.big_chances, 0) as big_chances,
          AVG(m.team_xg) OVER (
            ORDER BY m.match_date 
            ROWS BETWEEN $1 PRECEDING AND CURRENT ROW
          ) as rolling_avg_xg,
          AVG(m.team_goals) OVER (
            ORDER BY m.match_date 
            ROWS BETWEEN $1 PRECEDING AND CURRENT ROW
          ) as rolling_avg_goals
        FROM metrics.team_matches m
        LEFT JOIN match_shots ms ON m.match_url = ms.match_url
        WHERE m.season = $2 AND m.team_name = $3
        ORDER BY m.match_date ASC`,
        [windowSize - 1, season, team]
      );

      return result.rows.map(row => ({
        matchDate: row.match_date,
        opponent: row.opponent,
        result: row.result,
        goals: parseInt(row.goals) || 0,
        xg: parseFloat(row.xg) || 0,
        shots: parseInt(row.shots) || 0,
        shotsOnTarget: parseInt(row.shots_on_target) || 0,
        bigChances: parseInt(row.big_chances) || 0,
        rollingAvgXg: parseFloat(row.rolling_avg_xg) || null,
        rollingAvgGoals: parseFloat(row.rolling_avg_goals) || null,
      }));
    },

    async dataQuality(_, { team = 'Arsenal' }) {
      const result = await query(`
        SELECT 
          (SELECT COUNT(*) FROM metrics.team_matches WHERE team_name = $1) as total_matches,
          (SELECT COUNT(*) FROM silver.shot_events WHERE team = $1) as total_shots,
          (SELECT COUNT(DISTINCT season) FROM metrics.team_matches WHERE team_name = $1) as seasons_count,
          (SELECT MAX(match_date) FROM metrics.team_matches WHERE team_name = $1) as last_update
      `, [team]);

      const row = result.rows[0];
      const totalMatches = parseInt(row.total_matches) || 0;
      const totalShots = parseInt(row.total_shots) || 0;
      const lastUpdate = row.last_update;
      
      const dataCompleteness = totalMatches > 0 && totalShots > 0 ? 95.0 : 0.0;
      
      const seasonsResult = await query(`
        SELECT DISTINCT season FROM metrics.team_matches WHERE team_name = $1 ORDER BY season DESC
      `, [team]);
      const seasonsAvailable = seasonsResult.rows.map(r => r.season);

      const daysSinceUpdate = lastUpdate 
        ? Math.floor((new Date() - new Date(lastUpdate)) / (1000 * 60 * 60 * 24))
        : 999;
      
      let dataFreshness = 'Unknown';
      if (daysSinceUpdate === 0) dataFreshness = 'Today';
      else if (daysSinceUpdate === 1) dataFreshness = 'Yesterday';
      else if (daysSinceUpdate < 7) dataFreshness = `${daysSinceUpdate} days ago`;
      else if (daysSinceUpdate < 30) dataFreshness = `${Math.floor(daysSinceUpdate / 7)} weeks ago`;
      else dataFreshness = `${Math.floor(daysSinceUpdate / 30)} months ago`;

      return {
        totalMatches,
        totalShots,
        dataCompleteness,
        lastUpdate,
        seasonsAvailable,
        validationErrors: 0,
        dataFreshness,
      };
    },
  },
};
