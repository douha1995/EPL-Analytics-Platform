import { query } from '../db/connection.js';

/**
 * Calculate tactical phase based on shot/pass X coordinate
 * Defensive third: X < 0.33 → low_block
 * Middle third: 0.33 ≤ X < 0.66 → mid_block
 * Attacking third: X ≥ 0.66 → high_press
 */
function calculateTacticalPhase(xCoord) {
  const x = parseFloat(xCoord);
  if (x < 0.33) return 'low_block';
  if (x < 0.66) return 'mid_block';
  return 'high_press';
}

/**
 * Calculate pitch zone from X coordinate
 */
function calculatePitchZone(xCoord) {
  const x = parseFloat(xCoord);
  if (x < 0.33) return 'defensive_third';
  if (x < 0.66) return 'middle_third';
  return 'attacking_third';
}

/**
 * Determine player position status (simplified for now)
 * Could be enhanced with formation data
 */
function calculatePositionStatus(positionCategory, xCoord) {
  // Simplified logic - can be enhanced with actual formation data
  const x = parseFloat(xCoord);

  if (positionCategory === 'Defender' && x > 0.7) return 'out_of_position';
  if (positionCategory === 'Forward' && x < 0.3) return 'out_of_position';

  return 'in_position';
}

export const matchResolvers = {
  Query: {
    async matches(_, { season, team, limit = 100 }) {
      let sql = 'SELECT * FROM metrics.team_matches WHERE team_name = $1';
      const params = [team];

      if (season) {
        sql += ' AND season = $2';
        params.push(season);
      }

      sql += ' ORDER BY match_date DESC LIMIT $' + (params.length + 1);
      params.push(limit);

      const result = await query(sql, params);

      return result.rows.map(row => ({
        matchUrl: row.match_url,
        matchId: row.match_url,
        matchDate: row.match_date,
        season: row.season,
        teamName: row.team_name,
        opponent: row.opponent,
        venue: row.venue,
        result: row.result,
        teamGoals: parseInt(row.team_goals) || 0,
        opponentGoals: parseInt(row.opponent_goals) || 0,
        teamXg: parseFloat(row.team_xg) || 0,
        opponentXg: parseFloat(row.opponent_xg) || 0,
        xgOverperformance: parseFloat(row.xg_overperformance) || 0,
        // Backward compatibility
        arsenalGoals: parseInt(row.team_goals) || 0,
        arsenalXg: parseFloat(row.team_xg) || 0,
      }));
    },

    async matchList(_, { season, team }) {
      const result = await query(
        `SELECT
          m.match_url as match_id,
          CASE
            WHEN m.venue = 'H' THEN m.team_name || ' vs ' || m.opponent
            ELSE m.opponent || ' vs ' || m.team_name
          END as match_name,
          m.match_date,
          m.season
        FROM metrics.team_matches m
        WHERE m.season = $1 AND m.team_name = $2
        ORDER BY m.match_date DESC`,
        [season, team]
      );

      return result.rows.map(row => ({
        matchId: row.match_id,
        matchName: row.match_name,
        matchDate: row.match_date,
        season: row.season,
      }));
    },

    async matchShots(_, { matchId, team }) {
      // matchId is actually match_url in the database
      // If team is provided, filter to only that team's shots
      let sql = `SELECT * FROM silver.shot_events WHERE match_url = $1`;
      const params = [matchId];
      
      if (team) {
        sql += ` AND team = $2`;
        params.push(team);
      }
      
      sql += ` ORDER BY minute ASC`;
      
      const result = await query(sql, params);

      return result.rows.map(row => {
        const xCoord = parseFloat(row.x_coord) || 0;
        return {
          matchId: row.match_url,
          matchUrl: row.match_url,
          matchDate: row.match_date,
          season: row.season,
          homeTeam: row.home_team,
          awayTeam: row.away_team,
          homeGoals: parseInt(row.home_goals) || 0,
          awayGoals: parseInt(row.away_goals) || 0,
          homeXg: parseFloat(row.home_xg) || 0,
          awayXg: parseFloat(row.away_xg) || 0,
          playerName: row.player_name,
          playerId: row.player_id,
          team: row.team,
          minute: parseInt(row.minute) || 0,
          result: row.result,
          situation: row.situation,
          shotType: row.shot_type,
          x: xCoord,
          y: parseFloat(row.y_coord) || 0,
          xg: parseFloat(row.xg) || 0,
          assistedBy: row.assisted_by,
          lastAction: row.last_action,
          // Tactical phase calculations
          tacticalPhase: calculateTacticalPhase(xCoord),
          pitchZone: calculatePitchZone(xCoord),
          playerPositionStatus: calculatePositionStatus(row.position_category, xCoord),
        };
      });
    },

    async matchShotsBySeason(_, { season, team = 'Arsenal' }) {
      const result = await query(
        `SELECT * FROM silver.shot_events 
         WHERE season = $1 AND team = $2 
         ORDER BY match_date DESC, minute ASC`,
        [season, team]
      );

      return result.rows.map(row => ({
        matchId: row.match_url,
        matchUrl: row.match_url,
        matchDate: row.match_date,
        season: row.season,
        homeTeam: row.home_team,
        awayTeam: row.away_team,
        homeGoals: parseInt(row.home_goals) || 0,
        awayGoals: parseInt(row.away_goals) || 0,
        homeXg: parseFloat(row.home_xg) || 0,
        awayXg: parseFloat(row.away_xg) || 0,
        playerName: row.player_name,
        playerId: row.player_id,
        team: row.team,
        minute: parseInt(row.minute) || 0,
        result: row.result,
        situation: row.situation,
        shotType: row.shot_type,
        x: parseFloat(row.x_coord) || 0,
        y: parseFloat(row.y_coord) || 0,
        xg: parseFloat(row.xg) || 0,
        assistedBy: row.assisted_by,
        lastAction: row.last_action,
      }));
    },

    async matchPlayerShots(_, { matchId, playerName, team = 'Arsenal' }) {
      const result = await query(
        `SELECT * FROM silver.shot_events 
         WHERE match_url = $1 AND player_name = $2 AND team = $3
         ORDER BY minute ASC`,
        [matchId, playerName, team]
      );

      return result.rows.map(row => ({
        matchId: row.match_url,
        matchUrl: row.match_url,
        matchDate: row.match_date,
        season: row.season,
        homeTeam: row.home_team,
        awayTeam: row.away_team,
        homeGoals: parseInt(row.home_goals) || 0,
        awayGoals: parseInt(row.away_goals) || 0,
        homeXg: parseFloat(row.home_xg) || 0,
        awayXg: parseFloat(row.away_xg) || 0,
        playerName: row.player_name,
        playerId: row.player_id,
        team: row.team,
        minute: parseInt(row.minute) || 0,
        result: row.result,
        situation: row.situation,
        shotType: row.shot_type,
        x: parseFloat(row.x_coord) || 0,
        y: parseFloat(row.y_coord) || 0,
        xg: parseFloat(row.xg) || 0,
        assistedBy: row.assisted_by,
        lastAction: row.last_action,
      }));
    },

    async matchPlayerNetwork(_, { matchId, team = 'Arsenal' }) {
      const result = await query(
        `SELECT 
          assisted_by as assister,
          player_name as shooter,
          COUNT(*) as assists_count,
          COUNT(*) FILTER (WHERE result = 'Goal') as goals_from_assists,
          ROUND(SUM(xg), 2) as total_xg_assisted
        FROM silver.shot_events
        WHERE match_url = $1 
          AND team = $2
          AND assisted_by IS NOT NULL
          AND assisted_by != ''
        GROUP BY assisted_by, player_name
        ORDER BY assists_count DESC`,
        [matchId, team]
      );

      return result.rows.map(row => ({
        assister: row.assister,
        shooter: row.shooter,
        season: '', // Not applicable for single match
        assistsCount: parseInt(row.assists_count) || 0,
        goalsFromAssists: parseInt(row.goals_from_assists) || 0,
        totalXgAssisted: parseFloat(row.total_xg_assisted) || 0,
      }));
    },

    async matchPlayers(_, { matchId, team = 'Arsenal' }) {
      const result = await query(
        `SELECT DISTINCT player_name 
         FROM silver.shot_events 
         WHERE match_url = $1 AND team = $2 AND player_name IS NOT NULL
         ORDER BY player_name`,
        [matchId, team]
      );

      return result.rows.map(row => row.player_name);
    },
  },
};
