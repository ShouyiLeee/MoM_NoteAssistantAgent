import axios from "axios";
import { getToken } from "./auth";

const BASE_URL = "/api";

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT token to every request if available
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Auth types ──────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  roles: string[];
}

export interface LoginUrlResponse {
  url: string;
}

// ── Auth API calls ──────────────────────────────────────────────────────────

export const getGoogleLoginUrl = () =>
  api.get<LoginUrlResponse>("/auth/google/login").then((r) => r.data);

export const fetchCurrentUser = () =>
  api.get<AuthUser>("/auth/me").then((r) => r.data);

export const updateRoles = (roles: string[]) =>
  api.put<AuthUser>("/auth/roles", { roles }).then((r) => r.data);

// ── Types ──────────────────────────────────────────────────────────────────

export interface ExtractedInterview {
  company?: string;
  role?: string;
  stage?: string;
  result?: string;
  feedback?: string;
  date?: string;
}

export interface InterviewUploadResponse {
  interview_id: string;
  extracted: ExtractedInterview;
  message: string;
}

export interface InterviewSummary {
  id: string;
  company?: string;
  role?: string;
  stage?: string;
  result?: string;
  feedback?: string;
  date?: string;
}

export interface InterviewHistoryResponse {
  interviews: InterviewSummary[];
  total: number;
}

export interface AnalysisResponse {
  answer: string;
  context_chunks_used: number;
}

export interface MockQuestion {
  question: string;
  follow_ups: string[];
  focus_area?: string;
  difficulty?: string;
}

export interface MockInterviewResponse {
  session_id: string;
  question: MockQuestion;
  message: string;
  cv_context?: string;
}

export interface AnswerEvaluation {
  score: number;  // 1-10
  feedback: string;
  strengths: string[];
  gaps: string[];
}

export interface MockAnswerResponse {
  evaluation: AnswerEvaluation;
  next_question: MockQuestion | null;
  is_complete: boolean;
  final_summary?: string;
  turn: number;
  max_turns: number;
}

export interface ContactInfo {
  email?: string;
  phone?: string;
  linkedin?: string;
}

export interface CVResponse {
  id: string;
  user_id: string;
  version: number;
  name?: string;
  contact_info?: ContactInfo;
  summary?: string;
  skills: string[];
  experience_years?: number;
  education?: string;
  recent_roles: string[];
  change_summary?: string;
  original_filename?: string;
  created_at: string;
  is_active: boolean;
}

export interface CVExtractedFields {
  name?: string;
  contact_info?: ContactInfo;
  summary?: string;
  skills: string[];
  experience_years?: number;
  education?: string;
  recent_roles: string[];
}

export interface CVExtractResponse {
  raw_text: string;
  extracted: CVExtractedFields;
}

export interface CVSaveRequest {
  raw_text: string;
  original_filename?: string;
  name?: string;
  contact_info?: ContactInfo;
  summary?: string;
  skills: string[];
  experience_years?: number;
  education?: string;
  recent_roles: string[];
}

export interface AnalyticsResponse {
  total: number;
  pass_rate: number;
  by_result: Record<string, number>;
  by_stage: Record<string, { total: number; pass: number; fail: number; pending: number }>;
  by_company: Record<string, { total: number; pass: number; fail: number; pending: number }>;
  timeline: Array<{ month: string; count: number }>;
  weakest_stage?: string;
  streak?: number;
  skills_frequency?: Record<string, number>;
}

// ── API calls ──────────────────────────────────────────────────────────────

export const uploadInterview = (
  userId: string,
  rawNotes: string,
  jdText?: string
) =>
  api
    .post<InterviewUploadResponse>("/interviews/upload", {
      user_id: userId,
      raw_notes: rawNotes,
      jd_text: jdText || null,
    })
    .then((r) => r.data);

export const fetchHistory = (userId: string) =>
  api
    .get<InterviewHistoryResponse>("/interviews/history", {
      params: { user_id: userId },
    })
    .then((r) => r.data);

export const analyzeInterviews = (query: string) =>
  api
    .post<AnalysisResponse>("/interviews/analyze", { query })
    .then((r) => r.data);

export const startMockInterview = (
  userId: string,
  targetRole: string,
  difficulty: string
) =>
  api
    .post<MockInterviewResponse>("/mock-interview/start", {
      user_id: userId,
      target_role: targetRole,
      difficulty,
    })
    .then((r) => r.data);

export const submitMockAnswer = (
  targetRole: string,
  difficulty: string,
  question: string,
  answer: string,
  turn: number,
  maxTurns: number,
  cvContext?: string
): Promise<MockAnswerResponse> =>
  api
    .post<MockAnswerResponse>("/mock-interview/answer", {
      target_role: targetRole,
      difficulty,
      question,
      answer,
      turn,
      max_turns: maxTurns,
      cv_context: cvContext || null,
    })
    .then((r) => r.data);

/** Legacy — kept for backward compat */
export const uploadCV = (userId: string, rawText: string, filename?: string) =>
  api
    .post<CVResponse>("/cv/upload", {
      user_id: userId,
      cv_text: rawText,
      filename: filename || null,
    })
    .then((r) => r.data);

/** Legacy — kept for backward compat */
export const fetchCV = (userId: string) =>
  api.get<CVResponse>(`/cv/${userId}`).then((r) => r.data);

// ── New CV API (Phase 2) ────────────────────────────────────────────────────

export const uploadCVFile = (file: File): Promise<CVExtractResponse> => {
  const form = new FormData();
  form.append("file", file);
  return api
    .post<CVExtractResponse>("/cv/upload/file", form, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((r) => r.data);
};

export const uploadCVText = (cvText: string): Promise<CVExtractResponse> =>
  api
    .post<CVExtractResponse>("/cv/upload/text", null, { params: { cv_text: cvText } })
    .then((r) => r.data);

export const saveCV = (request: CVSaveRequest): Promise<CVResponse> =>
  api.post<CVResponse>("/cv/save", request).then((r) => r.data);

export const updateCV = (cvId: string, fields: Partial<CVSaveRequest>): Promise<CVResponse> =>
  api.put<CVResponse>(`/cv/${cvId}`, fields).then((r) => r.data);

export const fetchMyCV = (): Promise<CVResponse> =>
  api.get<CVResponse>("/cv/me").then((r) => r.data);

export const uploadInterviewFile = (file: File, jdText?: string): Promise<InterviewUploadResponse> => {
  const form = new FormData();
  form.append("file", file);
  if (jdText) form.append("jd_text", jdText);
  return api
    .post<InterviewUploadResponse>("/interviews/upload/file", form, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((r) => r.data);
};

export const fetchAnalytics = (userId: string) =>
  api.get<AnalyticsResponse>(`/analytics/${userId}`).then((r) => r.data);

// ── Interviewer types ────────────────────────────────────────────────────────

export interface JDResponse {
  id: string;
  owner_user_id: string;
  title: string;
  company: string;
  experience_level?: string;
  skills_required: string[];
  raw_text: string;
  summary?: string;
  created_at: string;
  is_active: boolean;
}

export interface JDCreateRequest {
  title: string;
  company: string;
  experience_level?: string;
  skills_required?: string[];
  raw_text: string;
}

export interface RankedCandidate {
  cv_id: string;
  candidate_name: string;
  fit_score: number;
  score_breakdown: { skills: number; experience: number; education: number };
  strengths: string[];
  gaps: string[];
  recommendation: string;
}

export interface MatchCandidatesResponse {
  jd_id: string;
  ranked_candidates: RankedCandidate[];
  total: number;
}

export interface QuestionItem {
  question: string;
  focus_area: string;
  difficulty: string;
  expected_points: string[];
  rubric: string;
}

export interface QuestionSetResponse {
  id: string;
  jd_id: string;
  owner_user_id: string;
  questions: QuestionItem[];
  difficulty: string;
  generated_at: string;
}

export interface CandidateProfile {
  user_id: string;
  name?: string;
  summary?: string;
  skills: string[];
  experience_years?: number;
  education?: string;
  recent_roles: string[];
  cv_id: string;
}

export interface CandidateScoreItem {
  jd_id: string;
  fit_score: number;
  score_breakdown: Record<string, number>;
  scored_at: string;
}

export interface CandidateDetailResponse {
  profile: CandidateProfile;
  scores: CandidateScoreItem[];
}

export interface InterviewerAnalytics {
  total_jds: number;
  active_jds: number;
  total_candidates_scored: number;
  total_question_sets: number;
  avg_fit_score?: number;
  top_jd_title?: string;
  top_jd_id?: string;
  recent_scores: Array<{
    candidate_name: string;
    jd_id: string;
    fit_score: number;
    scored_at: string;
  }>;
}

// ── Interviewer API calls ────────────────────────────────────────────────────

export const createJD = (data: JDCreateRequest): Promise<JDResponse> =>
  api.post<JDResponse>("/jd", data).then((r) => r.data);

export const listJDs = (): Promise<JDResponse[]> =>
  api.get<JDResponse[]>("/jd").then((r) => r.data);

export const getJD = (id: string): Promise<JDResponse> =>
  api.get<JDResponse>(`/jd/${id}`).then((r) => r.data);

export const updateJD = (id: string, data: Partial<JDCreateRequest> & { is_active?: boolean }): Promise<JDResponse> =>
  api.put<JDResponse>(`/jd/${id}`, data).then((r) => r.data);

export const deleteJD = (id: string): Promise<void> =>
  api.delete(`/jd/${id}`).then(() => undefined);

export const matchCandidates = (jdId: string, candidateUserIds: string[]): Promise<MatchCandidatesResponse> =>
  api.post<MatchCandidatesResponse>(`/jd/${jdId}/match-candidates`, { candidate_user_ids: candidateUserIds }).then((r) => r.data);

export const generateQuestions = (jdId: string, difficulty = "medium", count = 10): Promise<QuestionSetResponse> =>
  api.post<QuestionSetResponse>("/question-bank/generate", { jd_id: jdId, difficulty, count }).then((r) => r.data);

export const listQuestionSets = (): Promise<QuestionSetResponse[]> =>
  api.get<QuestionSetResponse[]>("/question-bank").then((r) => r.data);

export const getQuestionSet = (id: string): Promise<QuestionSetResponse> =>
  api.get<QuestionSetResponse>(`/question-bank/${id}`).then((r) => r.data);

export const deleteQuestionSet = (id: string): Promise<void> =>
  api.delete(`/question-bank/${id}`).then(() => undefined);

export const listCandidates = (params?: { skills?: string; min_experience?: number; max_experience?: number; search?: string }): Promise<CandidateProfile[]> =>
  api.get<CandidateProfile[]>("/candidates", { params }).then((r) => r.data);

export const getCandidate = (userId: string): Promise<CandidateDetailResponse> =>
  api.get<CandidateDetailResponse>(`/candidates/${userId}`).then((r) => r.data);

export const fetchInterviewerAnalytics = (): Promise<InterviewerAnalytics> =>
  api.get<InterviewerAnalytics>("/analytics/interviewer").then((r) => r.data);
