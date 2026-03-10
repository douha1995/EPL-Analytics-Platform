# EPL Analytics Platform

> **Production-ready football analytics platform** with AI-powered chatbot, 11 interactive dashboards, and fully automated data pipelines.

[![Python](https://img.shields.io/badge/Python-3.11-blue.svg)](https://www.python.org/)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue.svg)](https://www.postgresql.org/)
[![Airflow](https://img.shields.io/badge/Airflow-2.8.1-red.svg)](https://airflow.apache.org/)
[![GraphQL](https://img.shields.io/badge/GraphQL-Apollo-purple.svg)](https://www.apollographql.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)

---

## Overview

A comprehensive football analytics platform that automatically scrapes, processes, and visualizes match data for top EPL teams with an AI-powered RAG chatbot for natural language queries.

### Supported Teams
- **Arsenal** | **Liverpool** | **Manchester City** | **Manchester United**

### Key Features

| Feature | Description |
|---------|-------------|
| **Automated Pipeline** | Airflow DAGs trigger 2 hours after each match ends |
| **11 Dashboards** | Season overview, player stats, tactical analysis, shot networks, xT zones |
| **AI Chatbot** | RAG-powered assistant using local LLM (Ollama) - zero API costs |
| **Medallion Architecture** | Bronze (raw) > Silver (cleaned) > Gold (metrics) |
| **GraphQL API** | Multi-team resolvers with <100ms response times |
| **Modern Visualizations** | D3.js pitch maps, force-directed networks, Recharts trends |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           DATA SOURCES                                   │
│              Understat.com (xG, shots, player positions)                │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         APACHE AIRFLOW                                   │
│      Automated scraping - triggers 2 hours after match ends             │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          POSTGRESQL                                      │
│   ┌──────────────┐    ┌──────────────┐    ┌────────────────────────┐   │
│   │    BRONZE    │───▶│    SILVER    │───▶│         GOLD           │   │
│   │  (Raw JSON)  │    │  (Cleaned)   │    │ player_advanced_stats  │   │
│   │              │    │ shot_events  │    │ tactical_analysis      │   │
│   │              │    │              │    │ player_xt_stats        │   │
│   │              │    │              │    │ match_advanced_stats   │   │
│   └──────────────┘    └──────────────┘    └────────────────────────┘   │
└───────────────────┬─────────────────────────────────┬───────────────────┘
                    │                                 │
                    ▼                                 ▼
┌─────────────────────────────┐       ┌───────────────────────────────────┐
│      GRAPHQL BACKEND        │       │          RAG CHATBOT              │
│        (Node.js)            │       │     (Python + Ollama LLM)         │
│        Port: 4000           │       │         Port: 5000                │
└─────────────┬───────────────┘       └─────────────────┬─────────────────┘
              │                                         │
              └──────────────────┬──────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        REACT FRONTEND                                    │
│         11 Dashboards  •  AI Chatbot  •  Chakra UI  •  D3.js            │
│                          Port: 3000                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

```bash
# Start all services
make up

# Or manually:
docker compose up -d

# Check status
make status
```

### Access Points

| Service | URL | Credentials |
|---------|-----|-------------|
| **Dashboard** | http://localhost:3000 | - |
| **GraphQL API** | http://localhost:4000/graphql | - |
| **Airflow UI** | http://localhost:8080 | **** / ******** |
| **Chatbot API** | http://localhost:5000 | - |

---

## Dashboards

| Dashboard | Description |
|-----------|-------------|
| **Season Overview** | W/D/L record, points, xG trends |
| **Match Detail** | Shot maps, xG timeline, key moments |
| **Player Stats** | Goals, xG, conversion rates, shot accuracy |
| **Tactical Analysis** | Shots by period, situation breakdown |
| **Shot Networks** | Assist partnerships with D3.js visualization |
| **Expected Threat** | Zone-based xT analysis |
| **Passing Network** | Modern pitch visualization with curved connections |
| **Performance Trends** | Rolling averages, shots & big chances charts |
| **Opponent Analysis** | Head-to-head comparisons |
| **Player Comparison** | Side-by-side radar charts |
| **Match Insights** | Detailed per-match breakdown |

---

## AI Chatbot

Ask questions in natural language:

```
"How did Arsenal perform against Liverpool this season?"
"Who is our top scorer?"
"What's our xG trend in away games?"
"Compare Arsenal's conversion rate to Liverpool's"
```

**Technology:**
- **LLM:** Ollama with Qwen 2.5 (runs locally - no API costs)
- **Vector DB:** ChromaDB for semantic search
- **Embeddings:** Sentence-Transformers (all-MiniLM-L6-v2)

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Orchestration** | Apache Airflow |
| **Database** | PostgreSQL 16 (Medallion Architecture) |
| **Backend** | Node.js + Apollo GraphQL |
| **Frontend** | React 18 + Vite + Chakra UI + D3.js + Recharts |
| **AI/ML** | Ollama, ChromaDB, Sentence-Transformers |
| **Scraping** | Python + Playwright |
| **Infrastructure** | Docker Compose |

---

## Project Structure

```
Gunners-Platform/
├── airflow/              # DAGs for automated scraping
├── backend/              # GraphQL API (Node.js)
│   └── src/resolvers/    # Multi-team query handlers
├── database/             # SQL migrations & views
│   └── init/             # Medallion architecture setup
├── frontend-vite/        # React dashboards
│   └── src/components/   # 11 dashboard components
├── rag-chatbot/          # AI chatbot (Python)
│   └── rag/              # ChromaDB + Ollama integration
├── scrapers/             # Data collection scripts
├── docker-compose.yml
├── Makefile
└── DOCUMENTATION.md      # Complete technical guide
```

---

## Makefile Commands

```bash
make up              # Start all services
make down            # Stop all services
make status          # Show container status
make logs            # Follow all logs
make db-shell        # PostgreSQL shell
make rebuild-frontend # Rebuild frontend
make clean           # Remove everything
```

---

## Documentation

See **[DOCUMENTATION.md](DOCUMENTATION.md)** for:
- Complete architecture details
- Data flow diagrams
- Database schema reference
- GraphQL API documentation
- RAG chatbot tutorial
- Troubleshooting guide

---

## License

MIT License

---

<p align="center">
  <strong>EPL Analytics Platform</strong><br>
  Arsenal • Liverpool • Manchester City • Manchester United
</p>
