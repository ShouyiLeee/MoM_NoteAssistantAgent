import axios from "axios";

const BASE_URL = "/api";

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

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
}

export interface CVResponse {
  id: string;
  user_id: string;
  version: number;
  summary?: string;
  skills: string[];
  experience_years?: number;
  education?: string;
  recent_roles: string[];
  change_summary?: string;
  created_at: string;
  is_active: boolean;
}

export interface AnalyticsResponse {
  total: number;
  pass_rate: number;
  by_result: Record<string, number>;
  by_stage: Record<string, { total: number; pass: number; fail: number; pending: number }>;
  by_company: Record<string, { total: number; pass: number; fail: number; pending: number }>;
  timeline: Array<{ month: string; count: number }>;
  weakest_stage?: string;
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

export const analyzeInterviews = (userId: string, query: string) =>
  api
    .post<AnalysisResponse>("/interviews/analyze", {
      user_id: userId,
      query,
    })
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

export const uploadCV = (userId: string, rawText: string, filename?: string) =>
  api
    .post<CVResponse>("/cv/upload", {
      user_id: userId,
      cv_text: rawText,
      filename: filename || null,
    })
    .then((r) => r.data);

export const fetchCV = (userId: string) =>
  api.get<CVResponse>(`/cv/${userId}`).then((r) => r.data);

export const fetchAnalytics = (userId: string) =>
  api.get<AnalyticsResponse>(`/analytics/${userId}`).then((r) => r.data);
