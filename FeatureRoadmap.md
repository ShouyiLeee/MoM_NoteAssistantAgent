# MoM_NoteAssistantAgent — Feature Roadmap

> **Updated:** 2026-03-24 | **Status:** In Development — Phase 1

---

## Phase 1 — Auth Foundation

**Target:** Tuần 1 | **Status:** In Progress

| Feature | Details | Status |
|---|---|---|
| Google OAuth 2.0 | Login với Google, exchange code → JWT | Planned |
| User model | `users` table: id, google_id, email, name, roles[] | Planned |
| JWT auth | `python-jose`, access token, role claims | Planned |
| Auth endpoints | `/auth/google/login`, `/callback`, `/auth/me`, `PUT /auth/roles` | Planned |
| `require_role()` dependency | FastAPI dependency: raises 403 if role mismatch | Planned |
| Role selection UI | First-login page chọn Interviewee / Interviewer / Both | Planned |
| AuthContext (FE) | React context: user, token, roles, login(), logout() | Planned |
| Login page | `/login` với Google button | Planned |
| Axios interceptor | Auto-attach `Authorization: Bearer` header | Planned |
| Optional auth | Existing endpoints không bị break trong Phase 1 | Planned |

---

## Phase 2 — File Upload + CV Edit Flow

**Target:** Tuần 2 | **Status:** Planned

| Feature | Details | Status |
|---|---|---|
| PDF parser | `file_parser.py` — PyPDF2 | Planned |
| DOCX parser | `file_parser.py` — python-docx | Planned |
| CV extract-only endpoint | `POST /cv/upload/file` và `/cv/upload/text` → CVExtractResponse (không lưu DB) | Planned |
| CV save endpoint | `POST /cv/save` — lưu sau khi user confirm/edit | Planned |
| CV update endpoint | `PUT /cv/{id}` — sửa CV đã lưu | Planned |
| Name + contact extraction | LLM extract `name`, `contact_info` từ CV | Planned |
| CVEditForm (FE) | Editable form: name, contact, summary, skills tags, experience, education, recent roles | Planned |
| FileUploadZone (FE) | Drag-drop zone accept PDF/DOCX | Planned |
| `/cv` page rewrite | State machine: idle → extracting → editing → saving → saved | Planned |
| Interview file upload | `POST /interviews/upload/file` — DOCX/DOC | Planned |
| Enforce auth | `Depends(get_current_user)` trên tất cả CV + interview endpoints | Planned |

---

## Phase 3 — Interviewee Enhancements

**Target:** Tuần 3 | **Status:** Planned

| Feature | Details | Status |
|---|---|---|
| Skills radar chart | Dashboard — Chart.js radar showing skills distribution | Planned |
| Experience timeline | Bar chart showing interview activity over time | Planned |
| Streak counter | Days with consistent interview activity | Planned |
| CV-aware mock interview | Inject CV context từ `user_cvs` vào simulation prompt | Planned |
| Personalized AI analysis | CV gaps injected vào analysis system prompt | Planned |
| **Unified Interviews page (Interviewee)** | `/interviews` — Tab "New Note" (upload text/file) + Tab "History" (list + detail modal + edit). Thay thế `/upload` + `/history` | Planned |
| Interview detail + edit | `GET /interviews/{id}`, `PUT /interviews/{id}` | Planned |
| History modal | Click interview row → detail modal with edit fields | Planned |
| "Tailored to CV" badge | Mock page hiển thị CV context status | Planned |
| Route cleanup | Xóa `/upload` + `/history` → 301 redirect → `/interviews` | Planned |
| Role guard | `/mock`, `/cv`, `POST /mock-interview/start` chỉ dành cho `interviewee` | Planned |

---

## Phase 4 — Interviewer / Company Role

**Target:** Tuần 4 | **Status:** Planned

### Backend — Models & DB

| Feature | Details | Status |
|---|---|---|
| JobDescription model | `job_descriptions` table + Alembic migration | Planned |
| QuestionSet model | `question_sets` table + migration | Planned |
| CandidateJDScore model | `candidate_jd_scores` table — `candidate_id` FK (not `cv_id`) | Planned |
| Extend Candidate model | Thêm: `experience_years`, `education`, `recent_roles`, `cv_summary`, `cv_raw_text`, `cv_file_path`, `potential_level`, `status`, `jd_id`, `interviewer_user_id` | Planned |
| Extend interviews table | Thêm: `note_type` (`'personal'`/`'candidate'`), `candidate_id` FK nullable | Planned |

### Backend — Agents

| Feature | Details | Status |
|---|---|---|
| CV Review Agent | Score candidates vs JD, return ranked list with score_breakdown JSON | Planned |
| JD Analysis Agent (AI Candidate Intelligence) | NL queries → RAG (Qdrant candidate CVs) + structured PostgreSQL → ranked/filtered answer | Planned |
| Question Gen Agent | Generate N questions per JD: focus_area, expected_points, rubric | Planned |
| Orchestrator update | Add `cv_review`, `jd_analysis`, `question_gen` intents. Block `simulation` for `interviewer` role (403) | Planned |

### Backend — Services & API

| Feature | Details | Status |
|---|---|---|
| `candidate_import.py` service | `parse_and_extract_candidate_cv()` + `assess_potential_level()` + `embed_and_store_candidate_cv()` | Planned |
| Candidate import endpoints | `POST /candidates/import/file` + `/candidates/import/text` → extract + assess `potential_level` → return preview | Planned |
| Candidate save endpoint | `POST /candidates` — save confirmed import | Planned |
| Candidate filter/sort API | `GET /candidates?role=&min_exp=&max_exp=&potential_level=&skills=&status=&sort=&order=` | Planned |
| Candidate full CRUD | `GET /candidates/{id}`, `PUT /candidates/{id}`, `DELETE /candidates/{id}` | Planned |
| AI Candidate Intelligence endpoint | `POST /candidates/analyze` — JD Analysis Agent, NL query → matched candidates + reasoning | Planned |
| Interviewer interview notes | `POST /interviews/candidate` (note_type='candidate', requires candidate_id), `GET /interviews/candidate/history` | Planned |
| JD API | CRUD + `POST /jd/{id}/match-candidates` (CV Review Agent) | Planned |
| Question Bank API | `POST /question-bank/generate`, GET/DELETE CRUD | Planned |
| Interviewer Analytics API | `GET /analytics/interviewer` — pipeline funnel, potential breakdown, import trends | Planned |

### Frontend

| Feature | Details | Status |
|---|---|---|
| Role-conditional Sidebar | Interviewee nav vs Interviewer nav + role switcher. **No Mock Interview in Interviewer nav** | Planned |
| **Company Dashboard** | `/interviewer` — Pipeline funnel, potential donut chart, recently imported CVs, top candidates, active JDs | Planned |
| **Unified Interview Notes (Interviewer)** | `/interviewer/interviews` — Tab "Upload Note" (linked to candidate) + Tab "History" (all candidate interview notes) | Planned |
| **Candidate CV Repository** | `/interviewer/candidate-cv` — `CandidateImportFlow` + list view với filter sidebar + sort bar | Planned |
| **Candidate CV Import Pipeline (FE)** | Multi-step: upload → preview extracted fields + `potential_level` → confirm/edit → save | Planned |
| **Candidate CV Filter & Sort** | Filter: role, exp range slider, potential_level multi-select, skills tags, status. Sort: potential/exp/score/date | Planned |
| Candidate Detail page | `/interviewer/candidate-cv/[id]` — CV content, AI scores, interview history, notes, status log | Planned |
| **AI Candidate Intelligence** | `/interviewer/analysis` — chat interface, example prompts, answer + matched candidates list | Planned |
| JD Management page | `/interviewer/jd` — list/create/edit (`JDForm` component) | Planned |
| JD Detail page | `/interviewer/jd/[id]` — ranked candidates table + generate question bank | Planned |
| Question Bank page | `/interviewer/question-bank` — sets grouped by JD, generate/view/export | Planned |
| `PotentialBadge` component | High (green) / Medium (yellow) / Low (grey) badge | Planned |
| `CandidateCVCard` component | Card: name, role, exp years, potential badge, top skills chips, status chip | Planned |
| `CandidateFilterSidebar` component | Collapsible: role search, exp slider, potential checkboxes, skills tag input, status checkboxes | Planned |
| `CandidateImportFlow` component | Stepper: upload file → loading → preview form → confirm → success | Planned |
| `PipelineFunnel` component | Horizontal funnel chart: Applied → Shortlisted → Interviewed → Offered → Rejected | Planned |

---

## Future — Post v2

> Các tính năng sau khi Phase 1-4 hoàn thành

### LinkedIn Job Search Integration (Interviewee)
- Tự động tìm job phù hợp từ LinkedIn dựa trên CV + interview history
- Job matching bằng embedding similarity
- Bảng `job_listings`: title, company, location, url, match_score, status

### CV Improvement Engine (Interviewee)
- Gap Analysis: so sánh skills trong CV vs yêu cầu jobs đã apply
- ATS Optimization: suggest keywords từ JD
- CV Score = weighted(skills_match + experience_relevance + keyword_coverage)

### Job Notification System (Interviewee)
- Background worker (APScheduler) — check mỗi 4h
- In-app (bell icon) + Email (SendGrid) + Telegram bot

### Interview Preparation Engine (Interviewee)
- Prep Package: checklist chuẩn bị cho từng interview
- STAR Story Generator dựa trên CV experience
- Personalized questions dựa trên CV gaps

### Technical Improvements
- Streaming responses cho LLM operations
- Hybrid RAG (dense + sparse retrieval + reranking)
- Context compression
- Mobile app (React Native)
- Audio transcript ingestion (Whisper API)

---

## Dependency Order

```
Phase 1 (Auth + require_role)
  ↓ unblocks auth-protected endpoints + role routing
Phase 2 (File Upload + CV Edit)
  ↓ unblocks CV-aware features + candidate import pipeline
Phase 3 (Interviewee Enhancements — unified interviews, personalized AI, mock CV-aware)
  ↓ interviewee role fully stable
Phase 4 (Interviewer/Company Role — candidate CV, AI intelligence, dashboard, notes)
  ↓
Post-v2 Features
```
