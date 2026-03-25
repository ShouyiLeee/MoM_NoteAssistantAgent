# Interview Note Agent — Development Plan

Goal: Refactor thành dual-role platform (Interviewee + Interviewer/Company) với Google OAuth, file upload, CV edit flow, Candidate CV repository, AI Candidate Intelligence, và Interviewer feature set.

---

## Current Architecture (Built — Week 1-2)

- FastAPI backend + LangGraph multi-agent (Note, Analysis, Simulation, Memory)
- PostgreSQL (interviews, user_cvs, collections, candidates) + Qdrant (RAG)
- Next.js frontend: dashboard, upload, cv, analysis, mock, history
- Gemini Flash 2.5 LLM + text-embedding-004

---

## Target Architecture

```
User (Interviewee | Interviewer/Company)
 │
Google OAuth → JWT Auth
 │
Frontend (Next.js) — Role-conditional routing
 │
FastAPI — Auth middleware (require_role)
 │
LangGraph Orchestrator
 ├── Note Agent           (Interviewee — personal interview notes)
 ├── Analysis Agent       (Interviewee — CV-aware performance analysis)
 ├── Simulation Agent     (Interviewee ONLY — mock interview, NOT available to Interviewer)
 ├── Memory Agent         (Interviewee — retrieve personal history)
 ├── CV Review Agent      (Interviewer — score candidates vs JD)
 ├── JD Analysis Agent    (Interviewer — AI Candidate Intelligence, NL queries)
 └── Question Gen Agent   (Interviewer — generate Q&A bank with rubrics)
 │
Storage
 ├── PostgreSQL: users, interviews (note_type), user_cvs, candidates, job_descriptions, question_sets, candidate_jd_scores
 └── Qdrant: embeddings (interviewee notes + candidate CVs, separate collections)
```

### Navigation per Role

**Interviewee sidebar:**
Dashboard | Interviews | My CV | AI Analysis | Mock Interview

**Interviewer sidebar:**
Dashboard | Interviews | Candidate CV | AI Analysis | Job Descriptions | Question Bank

> Mock Interview does NOT appear in Interviewer sidebar and is blocked at backend level.

---

## Phase 1 — Auth Foundation

**Mục tiêu:** Google OAuth + JWT. Không phá vỡ features hiện tại.

### Backend
- `requirements.txt`: thêm `authlib`, `python-jose[cryptography]`, `python-multipart`
- `app/models/user.py`: `User(id UUID, google_id, email, name, avatar_url, roles[], created_at)`
- `app/auth/jwt.py`: `create_access_token()`, `verify_token()`
- `app/auth/oauth.py`: Google OAuth flow via authlib
- `app/auth/dependencies.py`: `get_current_user()`, `get_current_user_optional()`, `require_role()`
- `app/api/auth.py`: `/auth/google/login`, `/auth/google/callback`, `/auth/me`, `PUT /auth/roles`
- `app/config.py`: thêm `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `JWT_SECRET`, `FRONTEND_URL`
- Alembic migration: `001_add_users_table`
- Auth optional trên endpoints cũ (enforce ở Phase 2)

### Frontend
- `src/lib/auth.ts`: `storeToken()`, `getToken()`, `decodeToken()`, `clearToken()`
- `src/contexts/AuthContext.tsx`: context — `user`, `token`, `roles`, `login()`, `logout()`
- `src/pages/login.tsx`: Google login button
- `src/pages/auth/callback.tsx`: capture token từ URL, redirect
- `src/pages/role-select.tsx`: chọn role sau first login (Interviewee / Interviewer / Both)
- `src/_app.tsx`: wrap với `AuthProvider`
- `src/lib/api.ts`: axios interceptor gắn `Authorization: Bearer`

**Deliverable:** Login with Google hoạt động. Features cũ không bị phá.

---

## Phase 2 — File Upload + CV Edit Flow

**Mục tiêu:** Upload PDF/DOCX, extract → edit → save (2-step), enforce auth.

### Backend
- `requirements.txt`: thêm `pypdf2`, `python-docx`
- `app/services/file_parser.py`: `parse_cv_file()`, `parse_interview_file()`
- `app/models/cv.py`: thêm `name`, `contact_info`, `original_file_path`
- `app/schemas/cv.py`: `CVExtractResponse`, `CVExtractedFields`, `CVSaveRequest`
- `app/api/cv.py` refactor:
  - `POST /cv/upload/file` → extract only, KHÔNG lưu DB
  - `POST /cv/upload/text` → extract only, KHÔNG lưu DB
  - `POST /cv/save` → lưu sau khi user confirm/edit
  - `PUT /cv/{cv_id}` → update CV đã lưu
  - `GET /cv/me` → thay `/cv/{user_id}`
- `app/api/interviews.py`: thêm `POST /interviews/upload/file`
- Enforce `Depends(get_current_user)` trên tất cả CV + interview endpoints

### Frontend
- `src/components/cv/FileUploadZone.tsx`: drag-drop PDF/DOCX
- `src/components/cv/CVEditForm.tsx`: edit form tất cả extracted fields
- `src/pages/cv.tsx`: state machine `idle → extracting → editing → saving → saved`
- `src/pages/upload.tsx`: thêm file upload tab *(temporary — sẽ được gộp vào `/interviews` ở Phase 3)*
- `src/lib/api.ts`: `uploadCVFile()`, `uploadCVText()`, `saveCV()`, `uploadInterviewFile()`

**Deliverable:** File upload, AI extract, user edit, save. Auth enforced.

---

## Phase 3 — Interviewee Enhancements

**Mục tiêu:** Dashboard richer, AI Analysis personalized, Mock Interview CV-aware, gộp upload + history.

### Backend
- `app/api/analytics.py`: thêm `skills_frequency`, `experience_timeline`, `streak`
- `app/api/mock_interview.py`: fetch CV context từ `user_cvs`, inject vào simulation prompt
- `app/agents/analysis_agent.py`: inject CV context vào analysis system prompt
- `app/api/interviews.py`: thêm `GET /interviews/{id}`, `PUT /interviews/{id}`
- `app/agents/state.py`: thêm `user_role: str`
- Enforce `require_role("interviewee")` trên `/mock-interview/*`

### Frontend
- `src/pages/index.tsx`: skills radar chart (Chart.js), experience timeline, streak counter
- `src/pages/interviews.tsx`: **Trang hợp nhất** thay thế `/upload` + `/history`
  - Tab **"New Note"**: upload text + file, form nhập tay
  - Tab **"History"**: danh sách interviews, click → detail modal, edit fields
- `src/pages/analysis.tsx`: personalized mode — CV gap suggestions in sidebar
- `src/pages/mock.tsx`: "Tailored to your CV" badge, nudge if no CV uploaded (**Interviewee only**)
- Xóa `src/pages/upload.tsx` và `src/pages/history.tsx` → redirect 301 → `/interviews`

**Deliverable:** Interviewee experience personalized với CV + history. Upload/history unified.

---

## Phase 4 — Interviewer / Company Role

**Mục tiêu:** Candidate CV repository, AI Candidate Intelligence, company dashboard, interview notes, JD management, question bank.

### Backend — Models
- `app/models/jd.py`: `JobDescription(owner_user_id, title, company, experience_level, skills_required, raw_text, summary, is_active)`
- `app/models/question_set.py`: `QuestionSet(jd_id, owner_user_id, questions JSON, difficulty)`
- `app/models/candidate_score.py`: `CandidateJDScore(jd_id, candidate_id, fit_score, score_breakdown)`
- `app/models/candidate.py`: extend `Candidate` với:
  - `experience_years`, `education`, `recent_roles`
  - `cv_summary`, `cv_raw_text`, `cv_file_path`
  - `potential_level` (High/Medium/Low — AI-assessed on import)
  - `status`, `jd_id`, `interviewer_user_id`
- `app/models/interview.py`: thêm `note_type` (`'personal'`/`'candidate'`), `candidate_id` FK nullable

### Backend — Agents
- `app/agents/cv_review_agent.py`: score candidates vs JD, return ranked list with score_breakdown
- `app/agents/jd_analysis_agent.py`: AI Candidate Intelligence — NL query → RAG + PostgreSQL hybrid → ranked answer
- `app/agents/question_gen_agent.py`: generate N questions per JD với focus_area, expected_points, rubric
- `app/agents/orchestrator.py`: thêm `cv_review`, `jd_analysis`, `question_gen` intents; block `simulation` for interviewer role

### Backend — Services
- `app/services/candidate_import.py`:
  - `parse_and_extract_candidate_cv()`: file parse → LLM extract fields
  - `assess_potential_level()`: LLM assess High/Medium/Low từ extracted data
  - `embed_and_store_candidate_cv()`: chunk → embed → Qdrant (collection: candidate_cvs)

### Backend — API
- `app/api/jd.py`: CRUD + `POST /jd/{id}/match-candidates`
- `app/api/candidates.py`:
  - `POST /candidates/import/file` — upload PDF/DOCX → extract + assess `potential_level` → return preview
  - `POST /candidates/import/text` — text CV → same pipeline
  - `POST /candidates` — save confirmed candidate record
  - `GET /candidates` — filter: `role`, `min_exp`, `max_exp`, `potential_level`, `skills`, `status`, `jd_id`; sort: `potential_level`, `experience_years`, `evaluation_score`, `created_at`
  - `GET /candidates/{id}` — full detail with linked interviews
  - `PUT /candidates/{id}` — update status, notes, potential_level override
  - `DELETE /candidates/{id}`
  - `POST /candidates/analyze` — JD Analysis Agent (AI Candidate Intelligence)
- `app/api/interviews.py`: thêm interviewer endpoints:
  - `POST /interviews/candidate` — upload note about candidate (note_type='candidate', candidate_id required)
  - `GET /interviews/candidate/history` — list all candidate interview notes (JWT-scoped)
- `app/api/question_bank.py`: `POST /question-bank/generate`, GET/DELETE CRUD
- `app/api/analytics_interviewer.py`: `GET /analytics/interviewer` — pipeline funnel, potential breakdown, import trends

### Frontend
- Sidebar: role-conditional nav + role switcher. **Interviewer nav không có Mock Interview.**
- `src/pages/interviewer/index.tsx`: **Company Dashboard**
  - Pipeline funnel (Applied → Shortlisted → Interviewed → Offered → Rejected)
  - Donut chart: potential_level breakdown (High/Medium/Low)
  - Recently imported candidates (last 5, với PotentialBadge)
  - Top candidates by score
  - Active JDs summary
- `src/pages/interviewer/interviews.tsx`: **Unified Interview Notes**
  - Tab **"Upload Note"**: gắn với candidate cụ thể (dropdown select), upload text/file
  - Tab **"History"**: list tất cả interview notes, filter by candidate/date/result
- `src/pages/interviewer/candidate-cv.tsx`: **Candidate CV Repository**
  - Import button: `CandidateImportFlow` (upload → preview extracted + potential_level → confirm → save)
  - List view: `CandidateCVCard` (name, role, experience, potential badge, status chip)
  - Filter sidebar: `CandidateFilterSidebar` (role, exp range slider, potential_level, skills tags, status)
  - Sort bar: potential_level | experience | score | import date
- `src/pages/interviewer/candidate-cv/[id].tsx`: Candidate detail
  - CV content (full summary, skills, experience, education)
  - AI scores (fit score per JD, score breakdown chart)
  - Interview notes history (linked from `interviews` table)
  - Status history log
  - Manual notes editor
- `src/pages/interviewer/analysis.tsx`: **AI Candidate Intelligence**
  - Chat interface — text input, submit, display answer + matched candidates list
  - Example prompts: "Top 5 for Lead AI Engineer", "Who has 10+ years exp?"
  - Backed by `POST /candidates/analyze` → JD Analysis Agent
- `src/pages/interviewer/jd.tsx`: JD list/create/edit (`JDForm` component)
- `src/pages/interviewer/jd/[id].tsx`: JD detail — ranked candidates + generate questions
- `src/pages/interviewer/question-bank.tsx`: Question sets grouped by JD, generate/view/export
- **New components:**
  - `CandidateCVCard.tsx` — card with name, role, potential badge, skills chips, status
  - `PotentialBadge.tsx` — High (green) / Medium (yellow) / Low (grey) visual badge
  - `CandidateFilterSidebar.tsx` — collapsible filter panel
  - `CandidateImportFlow.tsx` — multi-step: upload → preview → confirm
  - `PipelineFunnel.tsx` — horizontal funnel chart for candidate status
  - `JDForm.tsx` — create/edit JD form

**Deliverable:** Full dual-role platform. Company có Candidate CV repository đầy đủ, AI Candidate Intelligence, dashboard customize, interview notes unified.

---

## Post-v2 Roadmap (Future)

- LinkedIn Job Search Integration (interviewee: match jobs vs CV + history)
- Job Notification System (Email / Telegram / APScheduler)
- CV Improvement Engine với ATS scoring
- Interview Preparation Engine (STAR stories, company research, prep checklist)
- Audio transcript ingestion (Whisper API)
- Streaming responses cho LLM operations
- Hybrid RAG (dense + sparse + reranking)
- Mobile app (React Native)
