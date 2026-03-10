# EPL Analytics Platform - Complete Documentation

A production-grade football analytics platform featuring automated data pipelines, 11 interactive dashboards, and an AI-powered chatbot for natural language queries across top EPL teams.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Data Flow & Pipeline](#data-flow--pipeline)
3. [Database Schema & Medallion Architecture](#database-schema--medallion-architecture)
4. [GraphQL API Reference](#graphql-api-reference)
5. [Dashboard Components](#dashboard-components)
6. [AI Chatbot (RAG System)](#ai-chatbot-rag-system)
7. [Quick Start Guide](#quick-start-guide)
8. [Development Guide](#development-guide)
9. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              EPL ANALYTICS PLATFORM                                  │
│                    Arsenal • Liverpool • Man City • Man United                       │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                           DATA SOURCES                                       │    │
│  │  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐       │    │
│  │  │    Understat     │    │      FBref       │    │   Future APIs    │       │    │
│  │  │  • xG per shot   │    │  • Advanced      │    │   • Opta         │       │    │
│  │  │  • Shot coords   │    │    statistics    │    │   • StatsBomb    │       │    │
│  │  │  • Player pos    │    │  • Possession    │    │                  │       │    │
│  │  └────────┬─────────┘    └────────┬─────────┘    └──────────────────┘       │    │
│  │           │                       │                                          │    │
│  └───────────┼───────────────────────┼──────────────────────────────────────────┘    │
│              │                       │                                               │
│              └───────────┬───────────┘                                               │
│                          │                                                           │
│                          ▼                                                           │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                         APACHE AIRFLOW                                       │    │
│  │                        (Port 8080)                                           │    │
│  │  ┌───────────────────────────────────────────────────────────────────────┐  │    │
│  │  │  DAG: epl_smart_match_scraper                                         │  │    │
│  │  │  • Monitors 4 teams for completed matches                             │  │    │
│  │  │  • Auto-triggers 2 hours after match ends                             │  │    │
│  │  │  • Handles rate limiting and retries                                  │  │    │
│  │  │  • Loads data into PostgreSQL medallion layers                        │  │    │
│  │  └───────────────────────────────────────────────────────────────────────┘  │    │
│  └──────────────────────────────────┬──────────────────────────────────────────┘    │
│                                     │                                                │
│                                     ▼                                                │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                         POSTGRESQL DATABASE                                  │    │
│  │                           (Port 5432)                                        │    │
│  │                                                                              │    │
│  │  ┌────────────────┐    ┌────────────────┐    ┌────────────────────────┐     │    │
│  │  │    BRONZE      │───▶│    SILVER      │───▶│        GOLD            │     │    │
│  │  │   (Raw JSON)   │    │   (Cleaned)    │    │    (Metrics/Views)     │     │    │
│  │  │                │    │                │    │                        │     │    │
│  │  │ understat_raw  │    │ shot_events    │    │ player_advanced_stats  │     │    │
│  │  │ match_reference│    │                │    │ tactical_analysis      │     │    │
│  │  │ scrape_runs    │    │                │    │ player_xt_stats        │     │    │
│  │  │                │    │                │    │ match_advanced_stats   │     │    │
│  │  │                │    │                │    │ team_matches           │     │    │
│  │  └────────────────┘    └────────────────┘    └────────────────────────┘     │    │
│  └──────────────────────────────┬─────────────────────────┬────────────────────┘    │
│                                 │                         │                          │
│            ┌────────────────────┘                         └────────────────────┐     │
│            │                                                                   │     │
│            ▼                                                                   ▼     │
│  ┌──────────────────────────┐                           ┌────────────────────────┐  │
│  │    GRAPHQL BACKEND       │                           │     RAG CHATBOT        │  │
│  │      (Port 4000)         │                           │     (Port 5000)        │  │
│  │                          │                           │                        │  │
│  │  Node.js + Apollo Server │                           │  Python + FastAPI      │  │
│  │                          │                           │                        │  │
│  │  Resolvers:              │                           │  ┌──────────────────┐  │  │
│  │  • playerStats           │                           │  │  Ollama LLM      │  │  │
│  │  • tacticalAnalysis      │                           │  │  (Qwen 2.5)      │  │  │
│  │  • matchAdvancedStats    │                           │  │  Port: 11434     │  │  │
│  │  • performanceTrends     │                           │  └──────────────────┘  │  │
│  │  • playerXTStats         │                           │                        │  │
│  │  • assistNetwork         │                           │  ┌──────────────────┐  │  │
│  │                          │                           │  │  ChromaDB        │  │  │
│  └────────────┬─────────────┘                           │  │  (Vector Store)  │  │  │
│               │                                         │  └──────────────────┘  │  │
│               │                                         └───────────┬────────────┘  │
│               │                                                     │               │
│               └─────────────────────┬───────────────────────────────┘               │
│                                     │                                                │
│                                     ▼                                                │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                          REACT FRONTEND                                      │    │
│  │                           (Port 3000)                                        │    │
│  │                                                                              │    │
│  │  ┌─────────────────────────────────────────────────────────────────────┐    │    │
│  │  │  Vite + React 18 + Chakra UI + D3.js + Recharts                     │    │    │
│  │  ├─────────────────────────────────────────────────────────────────────┤    │    │
│  │  │                                                                     │    │    │
│  │  │  11 INTERACTIVE DASHBOARDS                                          │    │    │
│  │  │  ├── Season Overview        ├── Shot Networks                      │    │    │
│  │  │  ├── Match Detail           ├── Expected Threat (xT)               │    │    │
│  │  │  ├── Player Stats           ├── Player Match Analysis              │    │    │
│  │  │  ├── Tactical Analysis      ├── Opponent Analysis                  │    │    │
│  │  │  ├── Performance Trends     ├── Player Comparison                  │    │    │
│  │  │  └── Match Insights                                                 │    │    │
│  │  │                                                                     │    │    │
│  │  │  AI CHATBOT (Popup/Minimize Design)                                 │    │    │
│  │  │  └── Natural language queries about any team/player/match          │    │    │
│  │  │                                                                     │    │    │
│  │  │  TEAM & SEASON SELECTOR                                             │    │    │
│  │  │  └── Switch between Arsenal, Liverpool, Man City, Man United       │    │    │
│  │  │                                                                     │    │    │
│  │  └─────────────────────────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### Services Summary

| Service | Technology | Port | Purpose |
|---------|------------|------|---------|
| **Frontend** | React 18 + Vite + Chakra UI + D3.js | 3000 | Interactive dashboards and AI chatbot UI |
| **Backend** | Node.js + Apollo GraphQL | 4000 | API layer with multi-team resolvers |
| **RAG Chatbot** | Python + FastAPI | 5000 | AI-powered analytics assistant |
| **Ollama LLM** | Qwen 2.5 (1.5B) | 11434 | Local language model inference |
| **Database** | PostgreSQL 16 | 5432 | Medallion architecture data storage |
| **Airflow** | Apache Airflow 2.8 | 8080 | Automated data pipeline orchestration |

### Supported Teams

| Team | Seasons Available | Data Points |
|------|-------------------|-------------|
| Arsenal | 2024-25, 2025-26 | Full historical + live |
| Liverpool | 2024-25, 2025-26 | Full historical + live |
| Manchester City | 2024-25, 2025-26 | Full historical + live |
| Manchester United | 2024-25, 2025-26 | Full historical + live |

---

## Data Flow & Pipeline

### End-to-End Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              DATA PIPELINE FLOW                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘

    MATCH ENDS
        │
        ▼
    ┌───────────────────┐
    │  AIRFLOW SENSOR   │  Monitors EPL fixtures API
    │  (Every 30 min)   │  Checks: Has match ended?
    └─────────┬─────────┘
              │
              ▼ (2 hours after match)
    ┌───────────────────┐
    │  PLAYWRIGHT       │  Headless browser scraping
    │  SCRAPER          │  • Opens Understat match page
    │                   │  • Extracts shot JSON data
    │                   │  • Handles JavaScript rendering
    └─────────┬─────────┘
              │
              ▼
    ┌───────────────────────────────────────────────────────────────────────────┐
    │                        POSTGRESQL DATABASE                                 │
    │                                                                            │
    │  BRONZE LAYER (Raw)              SILVER LAYER (Clean)                     │
    │  ┌─────────────────────┐         ┌─────────────────────┐                  │
    │  │ bronze.understat_raw│────────▶│ silver.shot_events  │                  │
    │  │ • Raw JSON shots    │ VIEW    │ • Normalized coords │                  │
    │  │ • Match metadata    │         │ • Player names      │                  │
    │  │ • Timestamps        │         │ • xG values         │                  │
    │  └─────────────────────┘         │ • Shot outcomes     │                  │
    │                                  └──────────┬──────────┘                  │
    │  ┌─────────────────────┐                    │                             │
    │  │bronze.match_reference│                   │                             │
    │  │ • Home/Away teams   │                    │                             │
    │  │ • Final scores      │                    │                             │
    │  │ • Season/Date       │                    ▼                             │
    │  └─────────────────────┘         GOLD LAYER (Metrics)                     │
    │                                  ┌─────────────────────────────────────┐  │
    │                                  │ metrics.player_advanced_stats      │  │
    │                                  │ • Goals, xG, conversion rates      │  │
    │                                  │ • Shot accuracy, big chances       │  │
    │                                  │ • Per-match aggregations           │  │
    │                                  ├─────────────────────────────────────┤  │
    │                                  │ metrics.tactical_analysis          │  │
    │                                  │ • Shots by time period (0-15, etc) │  │
    │                                  │ • Goals by situation               │  │
    │                                  │ • Set piece breakdown              │  │
    │                                  ├─────────────────────────────────────┤  │
    │                                  │ metrics.player_xt_stats            │  │
    │                                  │ • Expected Threat values           │  │
    │                                  │ • Zone-based threat analysis       │  │
    │                                  │ • High threat shot percentage      │  │
    │                                  ├─────────────────────────────────────┤  │
    │                                  │ metrics.match_advanced_stats       │  │
    │                                  │ • Per-match shot statistics        │  │
    │                                  │ • First/second half breakdown      │  │
    │                                  │ • Box vs outside box shots         │  │
    │                                  ├─────────────────────────────────────┤  │
    │                                  │ metrics.team_matches               │  │
    │                                  │ • Team xG per match                │  │
    │                                  │ • Results and opponents            │  │
    │                                  │ • Home/Away venue                  │  │
    │                                  └─────────────────────────────────────┘  │
    └───────────────────────────────────────────────────────────────────────────┘
              │                                           │
              │                                           │
              ▼                                           ▼
    ┌───────────────────┐                      ┌───────────────────┐
    │  GRAPHQL API      │                      │  CHROMADB         │
    │  (Node.js)        │                      │  (Vector Store)   │
    │                   │                      │                   │
    │  Resolvers query  │                      │  Match documents  │
    │  Gold layer views │                      │  are embedded     │
    └─────────┬─────────┘                      └─────────┬─────────┘
              │                                          │
              │                                          │
              ▼                                          ▼
    ┌───────────────────────────────────────────────────────────────┐
    │                      REACT FRONTEND                            │
    │                                                                │
    │   Dashboard Queries ─────▶ GraphQL ─────▶ Charts/Tables       │
    │   Chatbot Questions ─────▶ RAG API ─────▶ AI Responses        │
    │                                                                │
    └───────────────────────────────────────────────────────────────┘
```

### Automation Timeline

```
Match Kickoff (15:00)
        │
        ▼ (Match duration ~2 hours)
Match Ends (17:00)
        │
        ▼ (Wait 2 hours for data availability)
Airflow Trigger (19:00)
        │
        ├──▶ Scrape Understat (~30 seconds)
        │
        ├──▶ Load to Bronze (~5 seconds)
        │
        ├──▶ Silver views auto-update (instant)
        │
        ├──▶ Gold metrics auto-update (instant)
        │
        └──▶ Data available in dashboards
```

---

## Database Schema & Medallion Architecture

### Bronze Layer (Raw Data)

```sql
-- Raw shot data from Understat
bronze.understat_raw
├── match_url (PRIMARY KEY)
├── raw_shots (JSONB)        -- Full shot JSON from Understat
├── scraped_at (TIMESTAMP)
└── source (VARCHAR)

-- Match metadata
bronze.match_reference
├── match_url (PRIMARY KEY)
├── home_team (VARCHAR)
├── away_team (VARCHAR)
├── home_goals (INTEGER)
├── away_goals (INTEGER)
├── home_xg (DECIMAL)
├── away_xg (DECIMAL)
├── season (VARCHAR)         -- Format: "2024-25"
├── match_date (DATE)
└── team_name (VARCHAR)      -- Team perspective
```

### Silver Layer (Cleaned Data)

```sql
-- Normalized shot events (VIEW)
silver.shot_events
├── match_url
├── match_date
├── season
├── home_team / away_team
├── player_name / player_id
├── team                     -- Which team took the shot
├── minute
├── result                   -- Goal, SavedShot, MissedShots, BlockedShot
├── situation                -- OpenPlay, SetPiece, FromCorner, Penalty
├── shot_type                -- RightFoot, LeftFoot, Head
├── x_coord / y_coord        -- Normalized 0-1 coordinates
├── xg                       -- Expected goals value
├── assisted_by              -- Assister name
├── last_action              -- Pass, Dribble, Cross, etc.
└── position_category        -- Forward, Midfielder, Defender, Goalkeeper
```

### Gold Layer (Metric Views)

```sql
-- Player statistics aggregated by season
metrics.player_advanced_stats
├── team_name
├── player_name
├── season
├── matches_played
├── total_shots / goals / total_xg
├── avg_xg_per_shot / conversion_pct
├── shots_on_target / shot_accuracy_pct
├── big_chances / big_chances_scored
├── box_shots / outside_box_shots
├── open_play_shots / corner_shots / set_piece_shots
├── xg_overperformance
└── goals_per_match / xg_per_match

-- Tactical breakdown by team/season
metrics.tactical_analysis
├── team_name
├── season
├── shots_0_15 / shots_16_30 / ... / shots_76_90  -- By time period
├── goals_0_15 / goals_16_30 / ... / goals_76_90
├── shots_from_pass / dribble / cross / rebound
├── open_play_total / goals / xg
├── corner_total / goals / xg
├── set_piece_total / goals / xg
├── penalty_total / goals
└── big_chances_created / big_chances_converted

-- Expected Threat by player
metrics.player_xt_stats
├── team_name
├── player_name
├── position_category
├── season
├── total_shots / goals
├── total_xt / avg_xt_per_shot / max_xt_shot
├── total_xg / avg_xg_per_shot
├── high_threat_shots / high_threat_pct
└── xt_efficiency

-- Per-match detailed statistics
metrics.match_advanced_stats
├── match_url
├── match_date / season / team_name / opponent / venue / result
├── team_goals / opponent_goals
├── team_xg / opponent_xg
├── team_shots / opponent_shots
├── team_shots_on_target / opponent_shots_on_target
├── shot_accuracy_pct
├── big_chances / big_chances_scored
├── box_shots / outside_box_shots
├── first_half_shots / first_half_xg
├── second_half_shots / second_half_xg
└── avg_shot_xg

-- Team match results
metrics.team_matches
├── match_url
├── match_date / season
├── team_name / opponent
├── team_goals / opponent_goals
├── team_xg / opponent_xg
├── venue (Home/Away)
└── result (W/D/L)
```

### xT Calculation Function

```sql
-- Expected Threat grid function (12x8 zones)
metrics.calculate_xt_value(x DECIMAL, y DECIMAL) RETURNS DECIMAL
-- Maps pitch coordinates to threat values
-- Higher values near opponent's goal
-- Used for zone-based attacking analysis
```

---

## GraphQL API Reference

### Available Queries

```graphql
type Query {
  # Season and team data
  seasons(team: String): [Season!]!
  matchList(season: String!, team: String): [MatchListItem!]!
  
  # Player statistics
  playerStats(season: String!, team: String, limit: Int): [PlayerAdvancedStats!]!
  playerXTStats(season: String!, team: String, limit: Int): [PlayerXTStats!]!
  
  # Match analysis
  matchShots(matchId: String!): [Shot!]!
  matchAdvancedStats(matchId: String!): MatchAdvancedStats
  matchShotsBySeason(season: String!, team: String): [Shot!]!
  
  # Tactical and trends
  tacticalAnalysis(season: String!, team: String): TacticalAnalysis
  performanceTrends(season: String!, team: String, windowSize: Int): [PerformanceTrend!]!
  
  # Network analysis
  assistNetwork(season: String!, team: String): [AssistEdge!]!
  
  # Opponent analysis
  opponentComparison(season: String, team: String): [OpponentStats!]!
  
  # Data quality
  dataQuality(team: String): DataQuality
}
```

### Example Queries

```graphql
# Get player stats for Arsenal 2025-26
query {
  playerStats(season: "2025-26", team: "Arsenal", limit: 10) {
    playerName
    goals
    totalXg
    conversionPct
    xgOverperformance
  }
}

# Get tactical analysis
query {
  tacticalAnalysis(season: "2025-26", team: "Liverpool") {
    arsenalShots0_15
    arsenalGoals0_15
    bigChancesCreated
    bigChancesConverted
    openPlayGoals
    cornerGoals
  }
}

# Get performance trends with shot data
query {
  performanceTrends(season: "2025-26", team: "Arsenal") {
    matchDate
    opponent
    goals
    xg
    shots
    shotsOnTarget
    bigChances
    rollingAvgXg
  }
}

# Get match advanced stats
query {
  matchAdvancedStats(matchId: "https://understat.com/match/29060") {
    matchDate
    opponent
    arsenalGoals
    opponentGoals
    arsenalShots
    arsenalBigChances
    arsenalShotsOnTarget
  }
}
```

---

## Dashboard Components

### 1. Season Overview
**File:** `frontend-vite/src/components/dashboards/SeasonOverview.tsx`

Displays team performance summary for the selected season:
- Win/Draw/Loss record with visual breakdown
- Points total and league position
- Goals scored vs expected (xG over/underperformance)
- Clean sheets and failed to score counts

### 2. Match Detail
**File:** `frontend-vite/src/components/dashboards/MatchDetail.tsx`

Individual match analysis with:
- Shot map visualization on pitch (D3.js)
- xG timeline showing cumulative expected goals
- Goal scorers with minute and xG value
- Shot outcomes breakdown (goals, saves, misses, blocks)

### 3. Player Stats
**File:** `frontend-vite/src/components/dashboards/PlayerStats.tsx`

Comprehensive player statistics:
- Goals, assists, total xG
- Conversion rate and shot accuracy
- Big chances created/converted
- xG overperformance (clinical finishing indicator)
- Sortable and filterable table

### 4. Tactical Analysis
**File:** `frontend-vite/src/components/dashboards/TacticalAnalysis.tsx`

Team tactical patterns:
- Shots and goals by 15-minute periods (radar chart)
- Situation breakdown (open play, corners, set pieces, penalties)
- Shot creation methods (pass, dribble, cross, rebound)
- Big chances analysis

### 5. Shot Networks
**File:** `frontend-vite/src/components/dashboards/ShotNetworks.tsx`

Visualizes assist partnerships:
- Force-directed graph of passer-to-shooter connections
- Edge thickness represents actual assists (goals)
- Distinguishes assists (goals) from key passes (shots)
- Top assisters bar chart
- Partnership details table with conversion rates

### 6. Expected Threat (xT)
**File:** `frontend-vite/src/components/dashboards/ExpectedThreat.tsx`

Zone-based threat analysis:
- Player xT rankings
- High threat shot percentage
- xT efficiency (threat per xG)
- Position-based comparisons

### 7. Passing Network (Shot Creation)
**File:** `frontend-vite/src/components/dashboards/advanced/PassingNetworkEnhanced.tsx`

Modern pitch visualization:
- Football pitch with realistic markings and grass gradient
- Curved connection lines between players
- Player nodes sized by involvement
- Phase-based coloring (low block, mid block, high press)
- Interactive tooltips with pass details

### 8. Performance Trends
**File:** `frontend-vite/src/components/dashboards/PerformanceTrends.tsx`

Rolling performance analysis:
- xG vs Goals trend line
- Rolling 5-match averages
- Shots and big chances trend chart
- Match-by-match performance bars

### 9. Player Comparison
**File:** `frontend-vite/src/components/dashboards/PlayerComparison.tsx`

Side-by-side player analysis:
- Select two players to compare
- Radar chart comparison
- Key metrics table
- xG and goals visualization

### 10. Opponent Analysis
**File:** `frontend-vite/src/components/dashboards/OpponentAnalysis.tsx`

Head-to-head statistics:
- Win rate against each opponent
- Goals for/against breakdown
- xG performance by opponent
- Historical results

### 11. Match Insights
**File:** `frontend-vite/src/components/dashboards/MatchInsights.tsx`

Detailed per-match breakdown:
- Match selector dropdown
- Shot statistics with first/second half split
- Box vs outside box shots
- Shot quality analysis (avg xG per shot)
- Key moments timeline

---

## AI Chatbot (RAG System)

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RAG CHATBOT FLOW                                   │
└─────────────────────────────────────────────────────────────────────────────┘

User Question: "How did Arsenal perform against Liverpool?"
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 1: EMBEDDING                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Sentence Transformer (all-MiniLM-L6-v2)                            │    │
│  │  Converts question to 384-dimensional vector                        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 2: RETRIEVAL                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  ChromaDB Vector Search                                              │    │
│  │  • Finds top 5 most similar match documents                          │    │
│  │  • Searches across ALL teams (Arsenal, Liverpool, etc.)              │    │
│  │  • Returns match summaries with xG, goals, players                   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 3: AUGMENTATION                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Prompt Construction                                                 │    │
│  │  System Prompt (Football Analyst Persona)                            │    │
│  │  + Retrieved Match Context                                           │    │
│  │  + User Question                                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 4: GENERATION                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Ollama LLM (Qwen 2.5 - 1.5B parameters)                             │    │
│  │  • Runs locally (no API costs)                                       │    │
│  │  • Generates response using retrieved context                        │    │
│  │  • Includes source citations and confidence score                    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
                        AI Response with Match Statistics
```

### UI Design

The chatbot features a **popup/minimize design**:
- Floating button at bottom-right corner
- Click to expand chat window
- Close (X) or minimize (-) buttons in header
- Smooth scale animation on open/close
- Quick question buttons for common queries

### API Endpoints

```bash
# Health check
GET http://localhost:5000/health
Response: {"status": "healthy", "ollama": "connected", "chromadb": "connected"}

# Get statistics
GET http://localhost:5000/stats
Response: {
  "indexed_matches": 208,
  "teams": ["Arsenal", "Liverpool", "Manchester City", "Manchester United"],
  "model": "qwen2.5:1.5b"
}

# Chat endpoint
POST http://localhost:5000/chat
Body: {
  "question": "Who scored the most goals for Arsenal?",
  "conversation_history": []
}
Response: {
  "answer": "Based on the data, Viktor Gyokeres leads...",
  "sources": [{"match_date": "2025-12-27", "opponent": "Brighton", ...}],
  "confidence": 0.85
}

# Rebuild embeddings
POST http://localhost:5000/rebuild-embeddings
Response: {"status": "success", "matches_indexed": 208}
```

### Example Questions

```
"How did Arsenal perform against Liverpool this season?"
"Who is the top scorer for Manchester City?"
"What's Arsenal's xG trend in away games?"
"Compare Arsenal's conversion rate to Liverpool's"
"Which player has the best big chance conversion?"
"How many clean sheets does Arsenal have?"
```

---

## Quick Start Guide

### Prerequisites

- Docker & Docker Compose
- 8GB+ RAM (for Ollama LLM)
- Make (optional, for convenience commands)

### Start All Services

```bash
# Clone repository
git clone <repo-url>
cd Gunners-Platform

# Start everything
make up
# Or: docker compose up -d

# Check status
make status

# View logs
make logs
```

### Access Points

| Service | URL | Credentials |
|---------|-----|-------------|
| Frontend Dashboard | http://localhost:3000 | - |
| GraphQL Playground | http://localhost:4000/graphql | - |
| Airflow UI | http://localhost:8080 | admin / admin |
| RAG Chatbot API | http://localhost:5000 | - |

### First-Time Setup

```bash
# Wait for Ollama model download (first time only)
docker logs -f arsenalfc_ollama

# Rebuild chatbot embeddings
curl -X POST http://localhost:5000/rebuild-embeddings

# Verify data
curl http://localhost:5000/stats
```

---

## Development Guide

### Project Structure

```
Gunners-Platform/
├── airflow/                    # Data orchestration
│   └── dags/
│       └── epl_smart_match_scraper.py
│
├── backend/                    # GraphQL API
│   └── src/
│       ├── resolvers/          # Query handlers
│       │   ├── advanced.js     # performanceTrends, matchAdvancedStats
│       │   ├── player.js       # playerStats, playerXTStats, assistNetwork
│       │   └── tactical.js     # tacticalAnalysis
│       ├── schema/             # GraphQL type definitions
│       └── db/                 # PostgreSQL connection
│
├── database/                   # SQL migrations
│   └── init/
│       ├── 01_init_databases.sql
│       ├── 02_create_bronze_schema.sql
│       ├── 03_create_views.sql
│       ├── 08_add_multi_team_support.sql
│       └── 09_multi_team_metric_views.sql
│
├── frontend-vite/              # React frontend
│   └── src/
│       ├── components/
│       │   ├── dashboards/     # 11 dashboard components
│       │   ├── AIChatbot.tsx   # Popup chatbot UI
│       │   └── Header.tsx      # Team/season selector
│       ├── context/            # React contexts
│       └── lib/                # Apollo client
│
├── rag-chatbot/                # AI chatbot service
│   ├── app.py                  # FastAPI application
│   ├── rag/
│   │   ├── chain.py            # Ollama LLM integration
│   │   └── embeddings.py       # ChromaDB vector store
│   └── system_prompts/
│       └── analyst.txt         # AI persona prompt
│
├── scrapers/                   # Data collection
│   ├── backfill_team.py        # Universal team scraper
│   ├── playwright_scraper.py   # Browser automation
│   └── db_loader.py            # Database insertion
│
├── docker-compose.yml          # Container orchestration
├── Makefile                    # Convenience commands
├── README.md                   # Quick start
└── DOCUMENTATION.md            # This file
```

### Makefile Commands

```bash
# === Services ===
make up                  # Start all services
make down                # Stop all services
make restart             # Restart all services
make status              # Show container status

# === Logs ===
make logs                # Follow all logs
make logs-backend        # Backend logs only
make logs-frontend       # Frontend logs only

# === Database ===
make db-shell            # PostgreSQL shell
make db-check            # Check database status

# === Development ===
make rebuild-frontend    # Rebuild frontend container
make rebuild-backend     # Rebuild backend container
make frontend-shell      # Shell into frontend container
make backend-shell       # Shell into backend container

# === Airflow ===
make airflow-enable-dag DAG=epl_smart_match_scraper

# === Cleanup ===
make clean               # Remove all containers and volumes
```

### Adding a New Dashboard

1. Create component in `frontend-vite/src/components/dashboards/`
2. Add GraphQL query for data fetching
3. Register in `App.tsx` tab list
4. Add resolver in `backend/src/resolvers/` if needed
5. Create database view in `database/init/` if needed

### Running Database Migrations

```bash
# Run migration script manually
cat database/init/09_multi_team_metric_views.sql | \
  docker exec -i arsenalfc_postgres psql -U postgres

# Or recreate database from scratch
docker compose down -v
docker compose up -d
```

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| **White screen on frontend** | `docker compose build --no-cache frontend && docker compose up -d frontend` |
| **Database connection errors** | `docker compose restart postgres` then check logs |
| **Chatbot slow responses** | Expected (2-3 min on CPU). Use smaller model or add GPU |
| **No data in dashboards** | Run migration: `make db-shell` then run SQL scripts |
| **Airflow DAGs not loading** | `docker compose restart airflow-scheduler airflow-webserver` |

### Verify Services

```bash
# Check all containers are running
docker compose ps

# Check backend health
curl http://localhost:4000/health

# Check chatbot status
curl http://localhost:5000/stats

# Check database views exist
docker exec arsenalfc_postgres psql -U postgres -d arsenalfc_analytics -c "\dv metrics.*"
```

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f rag-chatbot
docker compose logs -f postgres
```

### Reset Everything

```bash
# Nuclear option - removes all data
docker compose down -v
docker compose up -d

# Then rebuild embeddings
curl -X POST http://localhost:5000/rebuild-embeddings
```

---

## Environment Variables

```yaml
# docker-compose.yml environment variables

# Database
POSTGRES_HOST: postgres
POSTGRES_PORT: 5432
POSTGRES_DB: arsenalfc_analytics
POSTGRES_USER: postgres
POSTGRES_PASSWORD: postgres

# RAG Chatbot
OLLAMA_HOST: http://ollama:11434
OLLAMA_MODEL: qwen2.5:1.5b

# Airflow
AIRFLOW_UID: 50000
AIRFLOW__CORE__EXECUTOR: LocalExecutor
```

---

## License

MIT License - Feel free to use this as a template for your own analytics projects!

---

*Built for EPL Analytics - Arsenal, Liverpool, Manchester City, Manchester United*
