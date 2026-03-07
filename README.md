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
| Job Seekers | "I keep failing but don't know why" | Track history, detect weaknesses, practice with mock interviews |
| Recruiters | "Hard to compare candidates objectively" | Structured candidate notes, AI-powered ranking |

---

## Architecture

```
User
 │
Frontend (Next.js)
 │
FastAPI  ─── POST /interviews/upload
         ─── POST /interviews/analyze
         ─── POST /mock-interview/start
         ─── GET  /interviews/history
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
| Backend | Python, FastAPI |
| Agent Framework | LangGraph, LangChain Core |
| LLM | Gemini Flash 2.5 (`google-genai`) |
| Embeddings | Gemini `text-embedding-004` |
| Structured DB | PostgreSQL + SQLAlchemy (async) |
| Vector DB | Qdrant |
| Frontend | Next.js, React, Tailwind CSS |

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
│   │   │   ├── llm.py                # Gemini LLM wrapper (single entry point)
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
│   │       └── mock_interview.py     # Mock interview endpoint
│   ├── tests/
│   │   └── fixtures/
│   │       └── sample_note.txt       # Example interview note for testing
│   ├── requirements.txt
│   └── .env.example
├── docker-compose.yml                # PostgreSQL + Qdrant
├── .gitignore
├── CLAUDE.md
└── README.md
```

---

## Quick Start

### 1. Prerequisites

- Python 3.11+
- Docker (for PostgreSQL and Qdrant)
- Gemini API key — get one at [Google AI Studio](https://aistudio.google.com)

### 2. Start Infrastructure

```bash
docker-compose up -d
```

This starts:
- PostgreSQL on `localhost:5432`
- Qdrant on `localhost:6333`

### 3. Set Up Backend

```bash
cd backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and set GEMINI_API_KEY=your-key-here
```

### 4. Run the Server

```bash
uvicorn app.main:app --reload
```

Server starts at `http://localhost:8000`
Interactive API docs at `http://localhost:8000/docs`

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

- [ ] Interview analytics dashboard (failure distribution, progress timeline)
- [ ] PDF and audio transcript ingestion
- [ ] Recruiter mode: candidate comparison and ranking
- [ ] Personalized learning plans
- [ ] Advanced RAG (hybrid retrieval, reranking)
- [ ] Next.js frontend

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `GEMINI_API_KEY` | — | Gemini API key (required) |
| `LLM_MODEL` | `gemini-2.5-flash` | LLM model name |
| `EMBEDDING_MODEL` | `text-embedding-004` | Embedding model |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/interview_agent` | PostgreSQL URL |
| `QDRANT_URL` | `http://localhost:6333` | Qdrant server URL |
| `QDRANT_COLLECTION` | `interview_notes` | Qdrant collection name |
| `TOP_K` | `5` | RAG retrieval count |
| `DEBUG` | `true` | Enable SQLAlchemy query logging |
