# Interview Note Agent

> AI-powered Interview Intelligence System — capture, analyze, and learn from every interview.

---

## Overview

**Interview Note Agent** transforms raw interview notes into structured knowledge, detects performance patterns, and generates personalized improvement plans using a multi-agent AI architecture.

```
Interview Data  →  Knowledge  →  Insight  →  Action
```

### Who is it for?

| User | Pain Point | Solution |
|---|---|---|
| Job Seekers (Interviewee) | "I keep failing but don't know why" | Track history, detect weaknesses, practice with mock interviews (AI-powered) |
| Companies / Recruiters (Interviewer) | "Hard to manage and compare candidates at scale" | Candidate CV repository with AI-assessed potential, AI Candidate Intelligence for natural language queries |

---

## Architecture

```
User
 │
Frontend (Next.js + Tailwind CSS)
 │
FastAPI (v0.2.0)
 ├── POST /interviews/upload
 ├── POST /interviews/analyze
 ├── POST /mock-interview/start
 ├── GET  /interviews/history
 ├── POST /cv/analyze
 └── GET  /analytics/...
 │
LangGraph Orchestrator
 │  (classifies user intent, routes to correct agent)
 ├── Note Agent        → extract structured data from raw notes
 ├── Analysis Agent    → RAG + LLM reasoning over interview history
 ├── Simulation Agent  → generate mock interview questions
 └── Memory Agent      → retrieve interview history
 │
Storage
 ├── PostgreSQL   → structured interview records
 └── Qdrant       → embeddings for semantic search (RAG)
```

### Multi-Agent Routing

| User Message | Intent | Agent |
|---|---|---|
| "I just had an interview at Google" | `note` | Note Agent |
| "Why do I keep failing coding rounds?" | `analysis` | Analysis Agent |
| "Give me a mock ML Engineer interview" | `simulation` | Simulation Agent |
| "Show me my interview history" | `memory` | Memory Agent |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11+, FastAPI |
| Agent Framework | LangGraph 0.2, LangChain Core |
| LLM | Gemini Flash 2.5 (`google-genai`) |
| Embeddings | Gemini `text-embedding-004` |
| Structured DB | PostgreSQL 16 + SQLAlchemy (async) |
| Vector DB | Qdrant |
| Frontend | Next.js, React 18, Tailwind CSS |
| Infrastructure | Docker, Docker Compose |

---

## Project Structure

```
MoM_NoteAssistantAgent/
├── backend/
│   ├── app/
│   │   ├── main.py                   # FastAPI app + lifespan
│   │   ├── config.py                 # Settings (pydantic-settings)
│   │   ├── agents/
│   │   │   ├── state.py              # Shared LangGraph AgentState
│   │   │   ├── orchestrator.py       # Graph definition + intent routing
│   │   │   ├── note_agent.py         # Extract & store interview data
│   │   │   ├── memory_agent.py       # Retrieve interview history
│   │   │   ├── analysis_agent.py     # RAG-powered performance analysis
│   │   │   └── simulation_agent.py   # Mock interview generation
│   │   ├── services/
│   │   │   ├── llm.py                # Gemini LLM wrapper
│   │   │   ├── embeddings.py         # Gemini embedding wrapper
│   │   │   └── rag.py                # Retrieval helper (embed + search)
│   │   ├── db/
│   │   │   ├── postgres.py           # SQLAlchemy async engine + session
│   │   │   └── qdrant_client.py      # Qdrant client + helpers
│   │   ├── models/
│   │   │   └── interview.py          # SQLAlchemy ORM models
│   │   ├── schemas/
│   │   │   └── interview.py          # Pydantic request/response schemas
│   │   └── api/
│   │       ├── interviews.py         # Upload + history endpoints
│   │       ├── analysis.py           # Analysis endpoint
│   │       ├── mock_interview.py     # Mock interview endpoint
│   │       ├── cv.py                 # CV analysis endpoint
│   │       └── analytics.py         # Analytics endpoint
│   ├── tests/
│   │   └── fixtures/
│   │       └── sample_note.txt       # Example interview note for testing
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── pages/                    # Next.js Pages Router
│   │   │   ├── index.tsx             # Home / Dashboard
│   │   │   ├── upload.tsx            # Upload interview notes
│   │   │   ├── history.tsx           # Interview history
│   │   │   ├── analysis.tsx          # Performance analysis
│   │   │   ├── mock.tsx              # Mock interview
│   │   │   └── cv.tsx                # CV analyzer
│   │   ├── components/               # Reusable UI components
│   │   ├── lib/                      # API client & utilities
│   │   └── styles/                   # Global styles
│   ├── package.json
│   └── next.config.js
├── docker-compose.yml                # PostgreSQL + Qdrant
├── CLAUDE.md
└── README.md
```

---

## Quick Start

### Prerequisites

- **Python 3.11+**
- **Node.js 18+** and npm
- **Docker Desktop** (for PostgreSQL and Qdrant)
- **Gemini API key** — get one at [Google AI Studio](https://aistudio.google.com)

---

### Step 1 — Start Infrastructure

```bash
# From the project root
## Quick Start — One Command (Docker)

> **Prerequisites:** [Docker Desktop](https://docs.docker.com/get-docker/) installed and running. That's it.

**Windows:**
```cmd
start.bat
```

**Linux / macOS:**
```bash
chmod +x start.sh
./start.sh
```

The script will:
1. Check Docker is running
2. Create `.env` from template (prompts for your Gemini API key)
3. Auto-generate a secure JWT secret
4. Build and start all 4 services via Docker Compose
5. Wait for everything to be healthy

Once ready:

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| Qdrant Dashboard | http://localhost:6333/dashboard |

**Other commands:**
```bash
./start.sh --stop      # Stop all services
./start.sh --restart   # Restart all services
./start.sh --logs      # View live logs
./start.sh --status    # Check service status
```

> On first startup, the backend automatically creates all PostgreSQL tables and the Qdrant collection.

---

### Manual Setup (without Docker — for development)

<details>
<summary>Click to expand</summary>

#### Step 1 — Start databases
```bash
docker-compose up -d postgres qdrant
```

#### Step 2 — Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Linux/Mac
# .venv\Scripts\activate    # Windows

pip install -r requirements.txt
cp .env.example .env
# Edit .env → set GEMINI_API_KEY

uvicorn app.main:app --reload
```

#### Step 3 — Frontend (new terminal)
```bash
cd frontend
npm install
npm run dev
```

| Terminal | Directory | Command |
|---|---|---|
| 1 | project root | `docker-compose up -d postgres qdrant` |
| 2 | `backend/` | `source .venv/bin/activate && uvicorn app.main:app --reload` |
| 3 | `frontend/` | `npm install && npm run dev` |

</details>

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `GEMINI_API_KEY` | — | **Required.** Gemini API key |
| `LLM_MODEL` | `gemini-2.5-flash` | LLM model name |
| `EMBEDDING_MODEL` | `text-embedding-004` | Embedding model |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/interview_agent` | PostgreSQL connection URL |
| `QDRANT_URL` | `http://localhost:6333` | Qdrant server URL |
| `QDRANT_COLLECTION` | `interview_notes` | Qdrant collection name |
| `TOP_K` | `5` | RAG retrieval count |
| `CHUNK_SIZE` | `500` | Text chunk size for embeddings |
| `CHUNK_OVERLAP` | `50` | Chunk overlap |
| `DEBUG` | `true` | Enable SQLAlchemy query logging |

---

## API Reference

### Upload Interview Notes

```http
POST /interviews/upload
Content-Type: application/json

{
  "user_id": "user-123",
  "raw_notes": "Interview with Google, ML Engineer. Stage: Coding. Failed on LRU Cache..."
}
```

**Response:**
```json
{
  "interview_id": "uuid-...",
  "extracted": {
    "company": "Google",
    "role": "ML Engineer",
    "stage": "Coding",
    "result": "Fail",
    "feedback": "Weak on algorithm optimization and time complexity"
  },
  "message": "Interview recorded successfully."
}
```

---

### Analyze Performance

```http
POST /interviews/analyze
Content-Type: application/json

{
  "user_id": "user-123",
  "query": "Why do I keep failing coding interviews?"
}
```

**Response:**
```json
{
  "answer": "Based on your 4 recorded interviews, you consistently struggle with...",
  "context_chunks_used": 5
}
```

---

### Start Mock Interview

```http
POST /mock-interview/start
Content-Type: application/json

{
  "user_id": "user-123",
  "target_role": "ML Engineer",
  "difficulty": "medium"
}
```

**Response:**
```json
{
  "session_id": "uuid-...",
  "question": {
    "question": "Design an LRU Cache with O(1) get and put operations.",
    "follow_ups": [
      "What data structures did you choose and why?",
      "Explain the time complexity of each operation.",
      "How would you handle thread safety?"
    ],
    "focus_area": "Data Structures & Algorithm Optimization",
    "difficulty": "medium"
  },
  "message": "Mock Interview — ML Engineer (Medium)..."
}
```

---

### Interview History

```http
GET /interviews/history?user_id=user-123
```

---

## Data Pipeline

### Note Ingestion
```
User uploads raw notes
    → Note Agent: LLM extracts company, role, stage, result, feedback, date
    → Structured record → PostgreSQL
    → Chunked + embedded raw text → Qdrant
```

### RAG Analysis
```
User asks a question
    → Embed query (Gemini text-embedding-004)
    → Retrieve Top-5 relevant chunks (Qdrant cosine similarity)
    → Build prompt with context
    → Gemini Flash 2.5 reasoning
    → Return insight
```

### Mock Interview
```
User requests mock interview
    → Retrieve user's weakness patterns via RAG
    → Generate targeted question + follow-ups (LLM)
    → Return session
```

---

## Development

### Run Tests

```bash
cd backend
pytest tests/ -v --cov=app
```

### Lint & Format

```bash
ruff check .
black .
```

### Type Check

```bash
mypy app/
```

---

## Roadmap

| Week | Milestone |
|---|---|
| Week 1 | Project setup, FastAPI, databases, basic orchestrator |
| Week 2 | MVP: all 4 agents working end-to-end |
| Week 3 | Better RAG, pattern detection, basic frontend dashboard |
| Week 4 | Analytics, prompt tuning, testing, documentation |

### Planned Features

**Interviewee:**
- [ ] Interview analytics dashboard (failure distribution, progress timeline)
- [ ] PDF and audio transcript ingestion
- [ ] Unified Interviews page (upload + history in one)
- [ ] CV-aware mock interview
- [ ] Personalized AI analysis with CV gap suggestions

**Interviewer / Company:**
- [ ] Candidate CV repository with import, filter, sort
- [ ] AI-assessed `potential_level` on every CV import (High / Medium / Low)
- [ ] AI Candidate Intelligence — natural language queries about candidates
- [ ] Company dashboard with pipeline funnel & top candidate overview
- [ ] Unified interview notes page (upload + history)
- [ ] JD management + candidate matching + question bank

**Technical:**
- [ ] Advanced RAG (hybrid retrieval, reranking)
- [ ] Auth & multi-user support (Google OAuth + JWT)
- [ ] Streaming responses for LLM operations
