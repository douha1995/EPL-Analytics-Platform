import { query } from '../db/connection.js';

export const seasonResolvers = {
  Query: {
    async teams() {
      const result = await query(`SELECT * FROM metrics.get_available_teams()`);
      return result.rows.map(row => ({
        name: row.team_name,
        seasonsCount: parseInt(row.seasons_count) || 0,
        totalMatches: parseInt(row.total_matches) || 0,
      }));
    },

    async seasons(_, { team }) {
      let sql = 'SELECT DISTINCT season FROM metrics.team_matches';
      const params = [];

      if (team) {
        sql += ' WHERE team_name = $1';
        params.push(team);
      }

      sql += ' ORDER BY season DESC';

      const result = await query(sql, params);
      return result.rows.map(row => row.season);
    },

    async seasonSummary(_, { season, team }) {
      const result = await query(
        `SELECT * FROM metrics.season_summary WHERE season = $1 AND team_name = $2`,
        [season, team]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        teamName: row.team_name,
        season: row.season,
        matchesPlayed: parseInt(row.matches_played) || 0,
        wins: parseInt(row.wins) || 0,
        draws: parseInt(row.draws) || 0,
        losses: parseInt(row.losses) || 0,
        points: parseInt(row.points) || 0,
        goalsFor: parseInt(row.goals_for) || 0,
        goalsAgainst: parseInt(row.goals_against) || 0,
        goalDifference: parseInt(row.goal_difference) || 0,
        totalXgFor: parseFloat(row.total_xg_for) || 0,
        totalXgAgainst: parseFloat(row.total_xg_against) || 0,
        avgXgPerMatch: parseFloat(row.avg_xg_per_match) || 0,
        totalXgOverperformance: parseFloat(row.total_xg_overperformance) || 0,
        homeMatches: parseInt(row.home_matches) || 0,
        awayMatches: parseInt(row.away_matches) || 0,
        homeWins: parseInt(row.home_wins) || 0,
        awayWins: parseInt(row.away_wins) || 0,
        winPercentage: parseFloat(row.win_percentage) || 0,
      };
    },

    async eplStandings(_, { season }) {
      const result = await query(
        `SELECT * FROM metrics.epl_standings WHERE season = $1 ORDER BY position ASC`,
        [season]
      );

      return result.rows.map(row => ({
        position: parseInt(row.position) || 0,
        teamName: row.team_name,
        season: row.season,
        played: parseInt(row.played) || 0,
        won: parseInt(row.won) || 0,
        drawn: parseInt(row.drawn) || 0,
        lost: parseInt(row.lost) || 0,
        goalsFor: parseInt(row.goals_for) || 0,
        goalsAgainst: parseInt(row.goals_against) || 0,
        goalDifference: parseInt(row.goal_difference) || 0,
        points: parseInt(row.points) || 0,
      }));
    },

    async headToHead(_, { team1, team2, season }) {
      let sql = `
        SELECT * FROM metrics.head_to_head
        WHERE team_1 = $1 AND team_2 = $2
      `;
      const params = [team1, team2];

      if (season) {
        sql += ' AND season = $3';
        params.push(season);
      }

      const result = await query(sql, params);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        team1: row.team_1,
        team2: row.team_2,
        season: row.season,
        matchesPlayed: parseInt(row.matches_played) || 0,
        team1Wins: parseInt(row.team_1_wins) || 0,
        draws: parseInt(row.draws) || 0,
        team2Wins: parseInt(row.team_2_wins) || 0,
        team1Goals: parseInt(row.team_1_goals) || 0,
        team2Goals: parseInt(row.team_2_goals) || 0,
        team1AvgXg: parseFloat(row.team_1_avg_xg) || 0,
        team2AvgXg: parseFloat(row.team_2_avg_xg) || 0,
      };
    },
  },
};
