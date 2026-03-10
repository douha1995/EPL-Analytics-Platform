import { gql } from 'apollo-server-express';

export const typeDefs = gql`
  # Scalar types
  scalar Date
  scalar Decimal

  # Team Info
  type Team {
    name: String!
    seasonsCount: Int!
    totalMatches: Int!
  }

  # Season Summary
  type SeasonSummary {
    teamName: String!
    season: String!
    matchesPlayed: Int!
    wins: Int!
    draws: Int!
    losses: Int!
    points: Int!
    goalsFor: Int!
    goalsAgainst: Int!
    goalDifference: Int!
    totalXgFor: Float!
    totalXgAgainst: Float!
    avgXgPerMatch: Float!
    totalXgOverperformance: Float!
    homeMatches: Int!
    awayMatches: Int!
    homeWins: Int!
    awayWins: Int!
    winPercentage: Float!
  }

  # EPL Standings Row
  type StandingsRow {
    position: Int!
    teamName: String!
    season: String!
    played: Int!
    won: Int!
    drawn: Int!
    lost: Int!
    goalsFor: Int!
    goalsAgainst: Int!
    goalDifference: Int!
    points: Int!
  }

  # Head to Head Stats
  type HeadToHead {
    team1: String!
    team2: String!
    season: String!
    matchesPlayed: Int!
    team1Wins: Int!
    draws: Int!
    team2Wins: Int!
    team1Goals: Int!
    team2Goals: Int!
    team1AvgXg: Float!
    team2AvgXg: Float!
  }

  # Match
  type Match {
    matchUrl: String!
    matchId: String
    matchDate: Date!
    season: String!
    teamName: String!
    opponent: String!
    venue: String!
    result: String!
    teamGoals: Int!
    opponentGoals: Int!
    teamXg: Float!
    opponentXg: Float!
    xgOverperformance: Float!
    # Backward compatibility
    arsenalGoals: Int
    arsenalXg: Float
  }

  # Shot Detail
  type Shot {
    matchId: String
    matchUrl: String!
    matchDate: Date!
    season: String!
    homeTeam: String!
    awayTeam: String!
    homeGoals: Int!
    awayGoals: Int!
    homeXg: Float!
    awayXg: Float!
    playerName: String
    playerId: String
    team: String!
    minute: Int!
    result: String!
    situation: String
    shotType: String
    x: Float!
    y: Float!
    xg: Float!
    assistedBy: String
    lastAction: String
    # Tactical phase information
    tacticalPhase: String # low_block, mid_block, high_press
    pitchZone: String # defensive_third, middle_third, attacking_third
    playerPositionStatus: String # in_position, out_of_position
  }

  # Player Advanced Stats
  type PlayerAdvancedStats {
    playerName: String!
    season: String!
    matchesPlayed: Int!
    totalShots: Int!
    goals: Int!
    totalXg: Float!
    avgXgPerShot: Float!
    conversionPct: Float!
    shotsOnTarget: Int!
    shotAccuracyPct: Float!
    missedShots: Int!
    blockedShots: Int!
    savedShots: Int!
    bigChances: Int!
    bigChancesScored: Int!
    bigChanceConversionPct: Float!
    boxShots: Int!
    outsideBoxShots: Int!
    avgShotDistance: Float!
    rightFootShots: Int!
    rightFootGoals: Int!
    leftFootShots: Int!
    leftFootGoals: Int!
    headers: Int!
    headerGoals: Int!
    openPlayShots: Int!
    openPlayGoals: Int!
    cornerShots: Int!
    setPieceShots: Int!
    penaltiesTaken: Int!
    penaltiesScored: Int!
    assists: Int!
    xgOverperformance: Float!
    shotsPerMatch: Float!
    goalsPerMatch: Float!
    xgPerMatch: Float!
  }

  # Assist Network
  type AssistNetwork {
    assister: String!
    shooter: String!
    season: String!
    assistsCount: Int!
    goalsFromAssists: Int!
    totalXgAssisted: Float!
    # Tactical phase breakdown
    lowBlockPasses: Int
    midBlockPasses: Int
    highPressPasses: Int
    tacticalPhase: String
  }

  # Passing Phase Analysis
  type PassingPhaseAnalysis {
    phase: String! # low_block, mid_block, high_press
    totalPasses: Int!
    successfulPasses: Int!
    assists: Int!
    goals: Int!
    totalXg: Float!
    avgXgPerPass: Float!
    passCompletionPct: Float!
  }

  # Expected Threat Stats
  type PlayerXTStats {
    playerName: String!
    positionCategory: String
    season: String!
    totalShots: Int!
    goals: Int!
    totalXt: Float!
    avgXtPerShot: Float!
    maxXtShot: Float!
    totalXg: Float!
    avgXgPerShot: Float!
    highThreatShots: Int!
    highThreatPct: Float!
    xtEfficiency: Float!
  }

  # Tactical Analysis
  type TacticalAnalysis {
    season: String!
    arsenalShots0_15: Int!
    arsenalShots16_30: Int!
    arsenalShots31_45: Int!
    arsenalShots46_60: Int!
    arsenalShots61_75: Int!
    arsenalShots76_90: Int!
    arsenalGoals0_15: Int!
    arsenalGoals16_30: Int!
    arsenalGoals31_45: Int!
    arsenalGoals46_60: Int!
    arsenalGoals61_75: Int!
    arsenalGoals76_90: Int!
    shotsFromPass: Int!
    shotsFromDribble: Int!
    shotsFromRebound: Int!
    shotsFromChip: Int!
    shotsFromCross: Int!
    openPlayTotal: Int!
    openPlayGoals: Int!
    openPlayXg: Float!
    cornerTotal: Int!
    cornerGoals: Int!
    cornerXg: Float!
    setPieceTotal: Int!
    setPieceGoals: Int!
    setPieceXg: Float!
    penaltyTotal: Int!
    penaltyGoals: Int!
    bigChancesCreated: Int!
    bigChancesConverted: Int!
  }

  # Match List Item
  type MatchListItem {
    matchId: String!
    matchName: String!
    matchDate: Date!
    season: String!
  }

  # Opponent Comparison
  type OpponentComparison {
    opponent: String!
    matchesPlayed: Int!
    wins: Int!
    draws: Int!
    losses: Int!
    winRatePct: Float!
    goalsFor: Int!
    goalsAgainst: Int!
    avgGoalsFor: Float!
    avgGoalsAgainst: Float!
    totalXgFor: Float!
    totalXgAgainst: Float!
    avgXgFor: Float!
    avgXgAgainst: Float!
    cleanSheets: Int!
    failedToScore: Int!
    lastPlayed: Date
    lastResult: String
  }

  # Match Advanced Stats
  type MatchAdvancedStats {
    matchUrl: String!
    matchDate: Date!
    season: String!
    opponent: String!
    venue: String!
    result: String!
    arsenalGoals: Int!
    opponentGoals: Int!
    arsenalXg: Float!
    opponentXg: Float!
    arsenalShots: Int!
    opponentShots: Int!
    arsenalShotsOnTarget: Int!
    opponentShotsOnTarget: Int!
    arsenalShotAccuracyPct: Float!
    arsenalBigChances: Int!
    arsenalBigChancesScored: Int!
    arsenalBoxShots: Int!
    arsenalOutsideBoxShots: Int!
    arsenalFirstHalfShots: Int!
    arsenalFirstHalfXg: Float!
    arsenalSecondHalfShots: Int!
    arsenalSecondHalfXg: Float!
    arsenalAvgShotXg: Float!
    opponentAvgShotXg: Float!
  }

  # Data Quality
  type DataQuality {
    totalMatches: Int!
    totalShots: Int!
    dataCompleteness: Float!
    lastUpdate: Date!
    seasonsAvailable: [String!]!
    validationErrors: Int!
    dataFreshness: String!
  }

  # Performance Trend
  type PerformanceTrend {
    matchDate: Date!
    opponent: String!
    result: String!
    goals: Int!
    xg: Float!
    shots: Int!
    shotsOnTarget: Int!
    bigChances: Int!
    rollingAvgXg: Float
    rollingAvgGoals: Float
  }

  # Query
  type Query {
    # Team queries
    teams: [Team!]!

    # Season queries
    seasons(team: String): [String!]!
    seasonSummary(season: String!, team: String!): SeasonSummary

    # EPL Standings
    eplStandings(season: String!): [StandingsRow!]!
    headToHead(team1: String!, team2: String!, season: String): HeadToHead

    # Match queries
    matches(season: String, team: String!, limit: Int): [Match!]!
    matchList(season: String!, team: String!): [MatchListItem!]!
    matchShots(matchId: String!, team: String): [Shot!]!
    matchShotsBySeason(season: String!, team: String): [Shot!]!

    # Player queries
    playerStats(season: String!, team: String, limit: Int): [PlayerAdvancedStats!]!
    playerShots(season: String!, playerName: String!, team: String): [Shot!]!

    # Assist network
    assistNetwork(season: String!, team: String, limit: Int): [AssistNetwork!]!
    passingPhaseAnalysis(season: String!, team: String): [PassingPhaseAnalysis!]!

    # Expected Threat
    playerXTStats(season: String!, team: String, limit: Int): [PlayerXTStats!]!

    # Tactical analysis
    tacticalAnalysis(season: String!, team: String): TacticalAnalysis

    # Player match analysis
    matchPlayerShots(matchId: String!, playerName: String!, team: String): [Shot!]!
    matchPlayerNetwork(matchId: String!, team: String): [AssistNetwork!]!
    matchPlayers(matchId: String!, team: String): [String!]!

    # Advanced analytics
    opponentComparison(season: String, team: String): [OpponentComparison!]!
    matchAdvancedStats(matchId: String!): MatchAdvancedStats
    performanceTrends(season: String!, team: String, windowSize: Int): [PerformanceTrend!]!
    dataQuality(team: String): DataQuality!
  }
`;
