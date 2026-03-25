# Interview Note Agent — Technical Design

## 1. Overview

Interview Note Agent là AI-powered platform giúp job seekers (Interviewee) và nhà tuyển dụng (Company/Interviewer) capture, analyze, và learn from interview experiences.

System dùng **multi-agent architecture** với **LangGraph** và **Gemini Flash 2.5** là LLM chính.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11+, FastAPI |
| Agent Framework | LangGraph 0.2, LangChain Core |
| LLM | Gemini Flash 2.5 (`google-genai`) |
| Embeddings | Gemini `text-embedding-004` |
| Auth | Google OAuth 2.0 (authlib), JWT (python-jose) |
| File Parsing | PyPDF2 (PDF), python-docx (DOCX) |
| Structured DB | PostgreSQL 16 + SQLAlchemy async |
| Vector DB | Qdrant |
| Frontend | Next.js 16, React 18, Tailwind CSS |
| Infrastructure | Docker, Docker Compose |

---

## 3. High-Level Architecture

```
User (Interviewee | Interviewer/Company)
 │
Google OAuth → JWT Token
 │
Frontend (Next.js) — Role-conditional routing
 │
FastAPI — Auth Middleware (Depends(get_current_user))
 │
LangGraph Orchestrator
 ├── Note Agent           → extract structured interview data        [Interviewee]
 ├── Analysis Agent       → RAG + CV-aware performance analysis      [Interviewee]
 ├── Simulation Agent     → CV-aware mock interview generation       [Interviewee ONLY]
 ├── Memory Agent         → retrieve interview history               [Interviewee]
 ├── CV Review Agent      → score & rank candidates vs JD            [Interviewer]
 ├── JD Analysis Agent    → AI Candidate Intelligence (NL queries)   [Interviewer]
 └── Question Gen Agent   → generate structured Q&A bank            [Interviewer]
 │
Storage Layer
 ├── PostgreSQL — structured data (users, interviews, user_cvs, candidates, jds, question_sets, candidate_jd_scores)
 └── Qdrant    — embeddings (interviewee notes + candidate CV chunks)
```

---

## 4. Auth Architecture

### Google OAuth Flow

```
Frontend → GET /auth/google/login
  → Backend returns Google OAuth URL (authlib)
  → Browser redirects to Google consent screen
  → Google redirects to GET /auth/google/callback?code=...
  → Backend: exchange code → get profile → upsert User in DB
  → Issue JWT (access_token)
  → Redirect frontend to /auth/callback?token=...
  → Frontend stores token, reads roles from JWT payload
```

### JWT Structure

```json
{
  "sub": "<user_uuid>",
  "email": "user@gmail.com",
  "roles": ["interviewee", "interviewer"],
  "exp": 1234567890
}
```

### Role System

| Role | Capabilities |
|---|---|
| `interviewee` | Upload & manage own CV, upload interview notes, AI performance analysis, mock interview, personal dashboard |
| `interviewer` | Company dashboard, Candidate CV repository (import/filter/sort/AI-assess), AI Candidate Intelligence, interview notes about candidates, JD management, question bank |
| Both | All features, role switcher in sidebar |

> **Mock Interview** (`/mock`, `POST /mock-interview/start`) là tính năng **chỉ dành riêng cho `interviewee`**. Role `interviewer` không có quyền truy cập.

### FastAPI Dependencies

```python
# app/auth/dependencies.py
get_current_user(token) -> User          # raises 401 if invalid
get_current_user_optional(token) -> User | None  # Phase 1 transition
require_role("interviewee") -> Depends   # raises 403 if wrong role
require_role("interviewer") -> Depends   # raises 403 if wrong role
```

---

## 5. Database Schema

### `users`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| google_id | VARCHAR UNIQUE | |
| email | VARCHAR UNIQUE | |
| name | VARCHAR | |
| avatar_url | VARCHAR | nullable |
| roles | VARCHAR[] | `['interviewee']` default |
| created_at | TIMESTAMPTZ | |

### `user_cvs` — Interviewee's own CV
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | VARCHAR indexed | FK → users.id |
| version | Integer | auto-increment per user |
| name | VARCHAR | extracted full name |
| contact_info | TEXT | JSON: `{email, phone, linkedin}` |
| original_file_path | VARCHAR | stored file path |
| original_filename | VARCHAR | |
| summary | TEXT | LLM-extracted summary |
| skills | TEXT | JSON array |
| experience_years | Integer | |
| education | TEXT | JSON |
| recent_roles | TEXT | JSON array |
| raw_text | TEXT | original content |
| change_summary | TEXT | diff vs prev version |
| created_at | TIMESTAMPTZ | |
| is_active | Boolean | only one active per user |

### `interviews` — Used by both roles
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | VARCHAR indexed | FK → users.id (owner of note) |
| note_type | VARCHAR | `'personal'` (interviewee) / `'candidate'` (interviewer) |
| candidate_id | UUID FK NULL | → candidates.candidate_id — set when note_type = 'candidate' |
| collection_id | UUID FK NULL | grouping |
| company | VARCHAR | |
| role | VARCHAR | |
| date | Date | |
| stage | VARCHAR | Coding / System Design / Behavioral / HR / General |
| result | VARCHAR | Pass / Fail / Pending |
| feedback | TEXT | |
| raw_notes | TEXT | |
| jd_text | TEXT | optional, interviewee paste JD |
| created_at | TIMESTAMPTZ | |

> - Interviewee: `note_type='personal'`, `candidate_id=NULL`
> - Interviewer: `note_type='candidate'`, `candidate_id=<id>` (linked to the candidate being interviewed)

### `job_descriptions`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| owner_user_id | UUID FK → users.id | interviewer |
| title | VARCHAR | e.g. "Senior ML Engineer" |
| company | VARCHAR | |
| experience_level | VARCHAR | Junior / Mid / Senior / Lead |
| skills_required | TEXT | JSON array |
| raw_text | TEXT | |
| summary | TEXT | LLM-extracted |
| created_at | TIMESTAMPTZ | |
| is_active | Boolean | |

### `question_sets`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| jd_id | UUID FK → job_descriptions.id | |
| owner_user_id | UUID FK → users.id | |
| questions | TEXT | JSON array of question objects |
| difficulty | VARCHAR | easy / medium / hard |
| generated_at | TIMESTAMPTZ | |

Question object format:
```json
{
  "question": "Explain bias-variance tradeoff",
  "focus_area": "ML Theory",
  "difficulty": "medium",
  "expected_points": ["definition of bias", "definition of variance", "tradeoff explanation"],
  "rubric": "5=all points covered, 3=partial, 1=incorrect"
}
```

### `candidate_jd_scores`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| jd_id | UUID FK → job_descriptions.id | |
| candidate_id | UUID FK → candidates.candidate_id | |
| fit_score | Float | 0.0 – 1.0 |
| score_breakdown | TEXT | JSON: `{skills: 0.8, experience: 0.7, education: 0.6}` |
| scored_at | TIMESTAMPTZ | |

### `candidates` — Candidate CV Repository (Interviewer/Company)
| Column | Type | Notes |
|---|---|---|
| candidate_id | UUID PK | |
| interviewer_user_id | UUID FK → users.id | company/interviewer who imported this CV |
| interviewee_user_id | UUID FK → users.id NULL | if this candidate is also a registered user |
| name | VARCHAR | extracted from CV |
| role | VARCHAR | current/target role — extracted from CV |
| skills | TEXT | JSON array — extracted from CV |
| experience_years | Integer | extracted from CV |
| education | TEXT | JSON — extracted from CV |
| recent_roles | TEXT | JSON array — work history from CV |
| cv_summary | TEXT | LLM-extracted overall summary |
| cv_raw_text | TEXT | full extracted text from uploaded file |
| cv_file_path | VARCHAR | stored file path |
| potential_level | VARCHAR | **AI-assessed on import**: `High` / `Medium` / `Low` |
| status | VARCHAR | `applied` / `shortlisted` / `interviewed` / `offered` / `rejected` |
| jd_id | UUID FK NULL | linked job description |
| evaluation_score | Float | CV vs JD fit score (0.0–1.0), set after matching |
| notes | TEXT | interviewer's manual notes |
| created_at | TIMESTAMPTZ | |

> **`potential_level`** được AI đánh giá tự động khi import CV, dựa trên: skills breadth & depth, experience_years, education quality, career progression. Đây là field dùng để filter/sort primary trong Candidate CV view.
>
> Khác với `user_cvs` (CV của interviewee tự upload), `candidates` là kho CV ứng viên do **company quản lý** — ứng viên không cần phải là user đã đăng ký.

---

## 6. Multi-Agent System

### Orchestrator — Intent Routing

| User Message | Role | Intent | Agent |
|---|---|---|---|
| "I just had an interview at Google" | Interviewee | `note` | Note Agent |
| "Why do I keep failing?" | Interviewee | `analysis` | Analysis Agent |
| "Give me a mock ML interview" | **Interviewee only** | `simulation` | Simulation Agent |
| "Show my interview history" | Interviewee | `memory` | Memory Agent |
| "Score these candidates vs this JD" | Interviewer | `cv_review` | CV Review Agent |
| "Who has 10+ years of experience?" | Interviewer | `jd_analysis` | JD Analysis Agent |
| "Most promising candidates for Lead AI Engineer?" | Interviewer | `jd_analysis` | JD Analysis Agent |
| "Which candidates know Python and Kubernetes?" | Interviewer | `jd_analysis` | JD Analysis Agent |
| "Compare Alice and Bob for the Senior ML role" | Interviewer | `jd_analysis` | JD Analysis Agent |
| "Candidates with High potential not yet contacted?" | Interviewer | `jd_analysis` | JD Analysis Agent |
| "Generate interview questions for this JD" | Interviewer | `question_gen` | Question Gen Agent |

### AgentState

```python
class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], operator.add]
    user_id: str
    user_role: str          # "interviewee" | "interviewer"
    intent: str             # note/analysis/simulation/memory/cv_review/jd_analysis/question_gen
    raw_input: str
    interview_data: dict | None
    retrieved_context: list[str]
    response: str
    collection_id: str | None
    mock_session: dict | None   # Interviewee only — None for interviewer
    jd_text: str | None
    cv_context: str | None
    jd_id: str | None           # Interviewer
    candidate_ids: list[str]    # Interviewer
    candidate_id: str | None    # Interviewer — single candidate for interview notes
    question_set: dict | None   # Interviewer
```

### Note Agent
```
[Interviewee] raw_notes + optional jd_text + optional cv_context
  → LLM extraction (company, role, date, stage, result, feedback)
  → Save to interviews (note_type='personal')
  → Chunk text → embed → store in Qdrant (filtered by user_id)

[Interviewer] raw_notes + candidate_id
  → LLM extraction (date, stage, result, feedback about candidate)
  → Save to interviews (note_type='candidate', candidate_id=...)
  → Embed → store in Qdrant (filtered by interviewer_user_id + candidate_id)
```

### Analysis Agent — CV-aware (Interviewee)
```
User query + CV context (from user_cvs)
  → RAG retrieve top-5 chunks (Qdrant, filtered by user_id, note_type='personal')
  → Build prompt: context + CV summary + query
  → Gemini reasoning → personalized insight about own performance
```

### Simulation Agent — CV-aware (Interviewee ONLY)
```
target_role + difficulty + cv_context
  → RAG retrieve weakness patterns from personal interview history
  → Generate question targeting CV gaps + weak stages
  → Return: question, follow_ups, focus_area, difficulty
```
> ⚠️ Simulation Agent is NEVER invoked for `interviewer` role. The orchestrator enforces this at routing time.

### CV Review Agent (Interviewer)
```
JD text + candidate IDs
  → Fetch each candidate from PostgreSQL (candidates table)
  → LLM: score candidate CV vs JD (skills, experience, education)
  → Save scores to candidate_jd_scores
  → Return ranked list with score breakdown
```

### JD Analysis Agent — AI Candidate Intelligence (Interviewer)
```
Natural language query (e.g. "top candidates for Lead AI?", "who has 10+ years exp?")
  → Extract filters/intent from query (role, experience range, skills, JD match)
  → RAG retrieve candidate CV chunks (Qdrant, filtered by interviewer_user_id)
  → Fetch structured data (experience_years, potential_level, skills) from PostgreSQL
  → LLM reasoning → ranked/filtered answer with candidate names + rationale
```

Example queries handled:
- "Candidates with more than 10 years of experience"
- "Most promising candidates for Lead AI Engineer role"
- "Who has both Python and system design skills?"
- "Compare the top 3 candidates for JD #5"
- "High potential candidates that haven't been contacted yet"
- "Candidates with ML background applying for backend roles"

### Question Gen Agent (Interviewer)
```
JD text + difficulty + count
  → LLM generate N structured questions
  → Each: question_text, focus_area, expected_points, rubric
  → Save to question_sets table
```

---

## 7. File Processing Pipelines

### 7a. Interviewee — Own CV Upload
```
Interviewee uploads PDF/DOCX
  ↓
file_parser.py: parse → raw text
  ↓
POST /cv/upload/file OR /cv/upload/text
  ↓
LLM extraction (name, contact, summary, skills, experience, education, recent_roles)
  ↓
Return CVExtractResponse (NOT saved to DB yet)
  ↓
Frontend: CVEditForm — user edits all fields
  ↓
POST /cv/save (with confirmed/edited payload)
  ↓
process_cv_from_extracted() → save to user_cvs
  ↓
Chunk raw_text → embed → store in Qdrant (collection: user CVs)
```

### 7b. Interviewer — Candidate CV Import
```
Interviewer uploads candidate PDF/DOCX
  ↓
file_parser.py: parse → raw text
  ↓
POST /candidates/import/file OR /candidates/import/text
  ↓
LLM extraction (name, role, skills, experience_years, education, recent_roles, cv_summary)
  ↓
LLM assessment → potential_level (High / Medium / Low)
  based on: skills depth, experience_years, education quality, career progression
  ↓
Return CandidateImportPreview (NOT saved yet)
  ↓
Frontend: quick confirm/edit form
  ↓
POST /candidates (save confirmed payload)
  ↓
Save to candidates table
  ↓
Chunk cv_raw_text → embed → store in Qdrant (collection: candidate CVs, filtered by interviewer_user_id)
```

---

## 8. API Endpoints

### Auth
```
GET  /auth/google/login        → returns OAuth URL
GET  /auth/google/callback     → exchange code, return JWT
GET  /auth/me                  → current user profile + roles
PUT  /auth/roles               → add/update roles
POST /auth/logout
```

### CV — Interviewee's own CV
```
POST /cv/upload/file           → multipart PDF/DOCX, returns CVExtractResponse
POST /cv/upload/text           → JSON body, returns CVExtractResponse
POST /cv/save                  → save confirmed/edited CV to user_cvs
PUT  /cv/{cv_id}               → update saved CV
GET  /cv/me                    → current user's active CV
GET  /cv/versions              → all CV versions
```

### Interviews — Both roles (unified upload + history)
```
# Interviewee (note_type='personal')
POST /interviews/upload        → text-based note
POST /interviews/upload/file   → multipart DOCX note
GET  /interviews/history       → list personal interviews (JWT-scoped)
GET  /interviews/{id}          → single interview detail
PUT  /interviews/{id}          → edit extracted fields
DELETE /interviews/{id}

# Interviewer (note_type='candidate')
POST /interviews/candidate     → note about a specific candidate interview (requires candidate_id)
GET  /interviews/candidate/history → list all candidate interview notes (JWT-scoped)
GET  /interviews/{id}          → single note detail (same endpoint, role-scoped)
PUT  /interviews/{id}          → edit note
DELETE /interviews/{id}

# AI Analysis — Interviewee only
POST /interviews/analyze       → Analysis Agent (RAG, CV-aware, personal history)
```

### Mock Interview — Interviewee ONLY
```
POST /mock-interview/start     → Simulation Agent: generate CV-aware question
                                 (403 if role = interviewer)
```

### Analytics
```
GET  /analytics/me             → Interviewee dashboard: pass rate, skills freq, timeline, streak
GET  /analytics/interviewer    → Interviewer dashboard: pipeline funnel, potential breakdown, import trends
```

### Job Descriptions — Interviewer
```
POST /jd                       → create JD
GET  /jd                       → list JDs for current interviewer
GET  /jd/{id}                  → JD detail + matched candidate scores
PUT  /jd/{id}
DELETE /jd/{id}
POST /jd/{id}/match-candidates → CV Review Agent → rank candidates vs this JD
```

### Candidate CV Repository — Interviewer
```
POST /candidates/import/file   → PDF/DOCX upload → extract + assess potential_level → preview
POST /candidates/import/text   → plain text CV → same pipeline
POST /candidates               → save confirmed candidate (after import preview)
GET  /candidates               → list with filters:
                                   ?role=...&min_exp=...&max_exp=...
                                   &potential_level=High,Medium
                                   &skills=python,kubernetes
                                   &status=shortlisted
                                   &sort=potential_level|experience_years|evaluation_score|created_at
                                   &order=desc
GET  /candidates/{id}          → full detail: CV, scores, notes, status history, linked interviews
PUT  /candidates/{id}          → update status, notes, jd_id, potential_level override
DELETE /candidates/{id}
POST /candidates/analyze       → AI Candidate Intelligence (JD Analysis Agent)
```

**AI Candidate Intelligence request/response:**
```json
POST /candidates/analyze
{
  "query": "Who has 10+ years experience and knows Kubernetes?"
}

Response:
{
  "answer": "Based on your candidate pool, 3 candidates match: ...",
  "matched_candidates": [
    { "candidate_id": "...", "name": "Alice", "experience_years": 12, "potential_level": "High" }
  ],
  "reasoning": "Selected based on experience_years >= 10 and Kubernetes in skills"
}
```

### Question Bank — Interviewer
```
POST /question-bank/generate   → Question Gen Agent: generate for a JD
GET  /question-bank            → list all question sets
GET  /question-bank/{id}
DELETE /question-bank/{id}
```

---

## 9. RAG Pipeline

### Interviewee RAG (personal interview history)
```
User Query
  ↓
Embed query (Gemini text-embedding-004)
  ↓
Qdrant search — Top-K=5, filter: user_id + collection=interview_notes
  ↓
Build context block (chunks separated by ---)
  ↓
Inject into Analysis Agent prompt (+ CV summary)
  ↓
Gemini Flash 2.5 → personalized performance insight
```

### Interviewer RAG (candidate CV pool)
```
Natural language query (AI Candidate Intelligence)
  ↓
Embed query (Gemini text-embedding-004)
  ↓
Qdrant search — Top-K=10, filter: interviewer_user_id + collection=candidate_cvs
  ↓
Hybrid: RAG chunks + structured PostgreSQL data (experience_years, potential_level, skills)
  ↓
LLM reasoning → filtered/ranked candidate list with rationale
```

Future improvements:
- Hybrid retrieval (dense + sparse)
- Reranking with cross-encoder
- Context compression

---

## 10. Frontend Routing

### Interviewee Routes
| Route | Page | Description |
|---|---|---|
| `/` | Personal Dashboard | Analytics: pass rate, skills radar, experience timeline, streak |
| `/interviews` | Interviews (Unified) | Tab **"New Note"** (upload text/file) + Tab **"History"** (list, detail modal, edit) |
| `/cv` | My CV | Upload → AI extract → edit → save. CV version history |
| `/analysis` | AI Performance Analysis | CV-aware chat: detect weaknesses, suggest improvements |
| `/mock` | Mock Interview | CV-aware mock session with adaptive follow-ups (**Interviewee only**) |

> Routes `/upload` và `/history` đã được **gộp thành `/interviews`** — một trang với 2 tab: **New Note** và **History**.

### Interviewer / Company Routes
| Route | Page | Description |
|---|---|---|
| `/interviewer` | Company Dashboard | Pipeline funnel, recently imported CVs, top candidates, active JDs |
| `/interviewer/interviews` | Interview Notes (Unified) | Tab **"Upload Note"** (note about candidate) + Tab **"History"** (all conducted interviews) |
| `/interviewer/candidate-cv` | Candidate CV Repository | Import CVs, filter/sort by role/exp/potential, list view |
| `/interviewer/candidate-cv/[id]` | Candidate Detail | CV content, AI scores, interview history, notes, status |
| `/interviewer/analysis` | AI Candidate Intelligence | Natural language chat: query candidate pool |
| `/interviewer/jd` | JD Management | Create/edit/list job descriptions |
| `/interviewer/jd/[id]` | JD Detail | Ranked candidates + question bank generation |
| `/interviewer/question-bank` | Question Bank | Question sets per JD, generate/view/export |

> **Interviewer có KHÔNG có route `/mock`**. Mock Interview bị chặn ở cả frontend (không có nav item) lẫn backend (403 Forbidden).

### Company Dashboard — Widget Breakdown
| Widget | Data Source | Description |
|---|---|---|
| CV Import Stats | `candidates` count | Total candidates, imported this week, pending review |
| Potential Breakdown | `candidates.potential_level` | Donut chart: High / Medium / Low counts |
| Recently Imported | `candidates ORDER BY created_at DESC LIMIT 5` | Name, role, potential_level badge |
| Top Candidates | `candidates ORDER BY potential_level, evaluation_score DESC LIMIT 5` | Quick card view |
| Active JDs | `job_descriptions WHERE is_active=true` | Title, candidate count, last activity |
| Pipeline Funnel | `candidates GROUP BY status` | Applied → Shortlisted → Interviewed → Offered → Rejected |

### Candidate CV Page — Filters & Sort
```
Filters (left sidebar):
  - Role            : text search or tag chips
  - Experience      : range slider (min_years – max_years)
  - Potential Level : checkbox multi-select (High / Medium / Low)
  - Skills          : tag autocomplete search
  - Status          : checkbox multi-select (applied / shortlisted / interviewed / offered / rejected)
  - Linked JD       : dropdown

Sort (top bar):
  - Potential Level  (High first — default)
  - Experience Years (most/least)
  - Import Date      (newest/oldest)
  - Evaluation Score (highest first)
```

### Auth Routes
| Route | Page |
|---|---|
| `/login` | Google login button |
| `/auth/callback` | Token capture → store → redirect |
| `/role-select` | First login: choose Interviewee / Interviewer / Both |

---

## 11. Future Improvements

- LinkedIn Job Search integration (match jobs to interviewee CV + history)
- Job notification system (Email / Telegram / APScheduler)
- CV Improvement Engine với ATS scoring
- Interview Preparation Engine (prep package, STAR stories from CV)
- Audio transcript ingestion (Whisper API)
- Streaming responses for long LLM operations
- Hybrid RAG (dense + sparse + reranking)
- Mobile app (React Native)
