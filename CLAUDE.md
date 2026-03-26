# Interview Note Agent — Project Context for Claude Code

## Project Overview

**Name**: Interview Note Agent
**Type**: AI-powered Interview Intelligence System (Portfolio Project)
**Goal**: Transform raw interview data into structured knowledge, insights, and actionable improvement plans for job seekers and recruiters.

**Core Value Proposition**:

```
Interview Data → Knowledge → Insight → Action
```

**Target Users**:
- Job Seekers: Track history, identify weaknesses, practice with mock interviews
- Recruiters: Organize candidate notes, compare and rank candidates objectively

---

## Tech Stack

### Backend
- **Language**: Python
- **Framework**: FastAPI
- **Agent Framework**: LangGraph (orchestration) + LangChain (tool abstraction)
- **LLM**: Gemini Flash 2.5 (cost-efficient for development)
- **Embeddings**: Gemini Embedding API (or open embedding models as fallback)

### Databases
- **Structured Data**: PostgreSQL
- **Semantic Search**: Qdrant (Vector Database)

### Frontend
- **Framework**: Next.js + React
- **Styling**: Tailwind CSS

---

## Architecture

### High-Level System Design

```
User
 │
Frontend (Next.js)
 │
API Layer (FastAPI)
 │
LangGraph Orchestrator
 ├── Note Agent          → Extract structured interview data from raw input
 ├── Analysis Agent      → Detect patterns, weaknesses, performance trends
 ├── Simulation Agent    → Generate mock interview sessions
 └── Memory Agent        → Store and retrieve interview knowledge
 │
Storage Layer
 ├── PostgreSQL          → Structured interview records
 └── Qdrant              → Embeddings / semantic search
```

### Agent Routing Logic (Orchestrator)

| User Intent | Route To |
|---|---|
| "I just had an interview with Google" | Note Agent |
| "Why do I keep failing coding interviews?" | Analysis Agent |
| "Give me a mock ML engineer interview" | Simulation Agent |
| Retrieve or store context | Memory Agent |

---

## Multi-Agent Design

### Note Agent
- **Input**: text notes, PDF files, transcript text
- **Pipeline**: Document → Text Extraction → LLM Extraction → Structured Record
- **Output fields**: `company`, `role`, `stage`, `result`, `feedback`, `date`
- **Storage**: Structured fields → PostgreSQL | Raw text chunks → Qdrant

### Memory Agent
- **Structured Memory**: Interview records, candidate data, results (PostgreSQL)
- **Semantic Memory**: Interview notes, feedback text, transcripts (Qdrant embeddings)

### Analysis Agent
- **Purpose**: Answer user queries about interview patterns and weaknesses
- **Pipeline**: User Query → Retriever → Relevant Interview Context → LLM Reasoning → Insight
- **Example output**: "You failed 4 coding interviews. Most common feedback: algorithm optimization, time complexity explanation"

### Simulation Agent
- **Input**: target role, difficulty level, user weaknesses
- **Output**: multi-question mock interview session with adaptive follow-ups
- **Difficulty levels**: Easy / Medium / Hard
- **Future**: Evaluate user answers and provide feedback

---

## Data Pipeline

### Ingestion Pipeline
```
User Upload → Note Agent → Structured Data → PostgreSQL
```

### Vector Pipeline
```
Interview Text → Chunking → Embedding → Qdrant
```

### RAG Pipeline
```
User Query → Retriever (Top-K=5, similarity search) → Prompt Construction → Gemini Flash 2.5 → Answer
```

---

## Database Schema

### interviews
| Column | Type |
|---|---|
| id | UUID / serial PK |
| company | text |
| role | text |
| date | date |
| stage | text (Coding, System Design, Behavioral, HR) |
| result | text (Pass / Fail / Pending) |
| feedback | text |

### candidates (Recruiter mode)
| Column | Type |
|---|---|
| candidate_id | UUID / serial PK |
| name | text |
| role | text |
| skills | jsonb |
| evaluation_score | float |

### collections
| Column | Type |
|---|---|
| collection_id | UUID / serial PK |
| user_id | UUID FK |
| name | text |
| type | text (job_seeker / recruiter) |

---

## API Endpoints

```
POST   /interviews/upload       → Note Agent: ingest and extract interview data
POST   /interviews/analyze      → Analysis Agent: answer analysis queries
POST   /mock-interview/start    → Simulation Agent: begin mock interview session
GET    /interviews/history      → Memory Agent: retrieve interview history
```

---

## Development Plan (1 Month)

### Week 1 — System Foundation
- Project setup: repo, Python env, FastAPI, LangGraph
- Database setup: PostgreSQL schema, Qdrant
- Basic Orchestrator Agent scaffold
- API endpoints: `POST /upload_note`, `GET /interview_history`

### Week 2 — MVP Completion
- Note Agent: extract structured data from notes
- Memory Agent: store and retrieve interview records
- Analysis Agent: detect weaknesses
- Basic RAG pipeline
- Basic Simulation Agent: generate mock questions
- Full end-to-end user flow working

### Week 3 — Improvements
- Improve RAG: better chunking, metadata filtering
- Improve Analysis Agent: pattern detection, weakness classification
- Simulation Agent: multi-question sessions, difficulty levels
- Basic frontend dashboard: history, analysis results, mock interview UI

### Week 4 — Polish
- Interview analytics: failure distribution, progress timeline
- Better orchestrator routing logic
- Prompt engineering: analysis + simulation prompts
- Manual testing and performance optimization
- Documentation: README, architecture diagram, setup guide

---

## Project Structure (Target)

```
MoM_NoteAssistantAgent/
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI entrypoint
│   │   ├── api/                    # Route handlers
│   │   │   ├── interviews.py
│   │   │   ├── analysis.py
│   │   │   └── mock_interview.py
│   │   ├── agents/                 # LangGraph agents
│   │   │   ├── orchestrator.py
│   │   │   ├── note_agent.py
│   │   │   ├── memory_agent.py
│   │   │   ├── analysis_agent.py
│   │   │   └── simulation_agent.py
│   │   ├── services/               # Business logic
│   │   │   ├── rag.py
│   │   │   ├── embeddings.py
│   │   │   └── extraction.py
│   │   ├── db/                     # Database layer
│   │   │   ├── postgres.py
│   │   │   └── qdrant.py
│   │   ├── models/                 # SQLAlchemy models
│   │   └── schemas/                # Pydantic schemas
│   ├── tests/
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── app/                    # Next.js App Router
│   │   ├── components/
│   │   └── lib/
│   └── package.json
├── docs/
│   ├── Interview_Note_Agent_Proposal.md
│   ├── Planning.md
│   └── Tech.md
├── CLAUDE.md
└── README.md
```

---

## Coding Standards

### Naming Conventions
- Python files: `snake_case` (e.g., `note_agent.py`, `rag_service.py`)
- Python functions/variables: `snake_case`
- Python classes: `PascalCase` (e.g., `NoteAgent`, `AnalysisAgent`)
- Constants: `SCREAMING_SNAKE_CASE` (e.g., `TOP_K`, `GEMINI_MODEL`)
- TypeScript/Next.js: follow conventions in parent `CLAUDE.md`

### Environment Variables (Required)
```bash
# LLM
GEMINI_API_KEY=...

# Databases
DATABASE_URL=postgresql://user:pass@localhost:5432/interview_agent
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=interview_notes

# App
DEBUG=true
```

### Key Development Rules
- All LLM calls go through a single service layer (`services/llm.py`) — do not call Gemini API directly in agents
- All DB access goes through `db/postgres.py` and `db/qdrant.py` — no direct ORM calls in route handlers
- Agents communicate via LangGraph state, not direct function calls
- Use Pydantic schemas for all API request/response validation
- Never hardcode API keys — always use `.env`

---

## Common Development Commands

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload        # Start dev server at localhost:8000

# Run tests
pytest tests/ -v --cov=app

# Lint
ruff check .
black .

# Frontend
cd frontend
npm install
npm run dev                          # Start at localhost:3000

# Start Qdrant (Docker)
docker run -p 6333:6333 qdrant/qdrant

# Start PostgreSQL (Docker)
docker run -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres
```

---

## Features Reference

| Feature | Description | Status |
|---|---|---|
| Interview Collection | Upload & organize notes by company/role | Week 1-2 |
| Knowledge Base | Structured + semantic storage of interviews | Week 2 |
| Analytics Dashboard | Metrics, failure distribution, timeline | Week 3-4 |
| AI Interview Coach | Strengths/weaknesses analysis + improvement plan | Week 2-3 |
| Interview Simulation | Mock interviews with adaptive follow-ups | Week 2-3 |
| Candidate Ranking | Recruiter mode: compare and rank candidates | Future |

---

## Notes for Claude Code

1. **LangGraph is the core framework** — all agent logic must use LangGraph state graphs, not ad-hoc function chains
2. **Gemini Flash 2.5** is the LLM — use `google-genai` SDK (not deprecated `google-generativeai`)
3. **RAG is central** — almost all analysis queries go through the RAG pipeline, not direct DB queries
4. **Week 1-2 focus**: get the backend pipeline working end-to-end before touching frontend
5. **Qdrant for vectors, PostgreSQL for structured** — never store embeddings in PostgreSQL or structured records in Qdrant
6. **Test with realistic interview notes** — create fixture files under `tests/fixtures/` for consistent testing

---

**Project Stage**: Planning / Early Development
**LLM**: Gemini Flash 2.5
**Last Updated**: 2026-03-07
