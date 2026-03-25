import { useEffect, useState } from "react";
import Head from "next/head";
import Layout, { useAppToast } from "@/components/layout/Layout";
import {
  startMockInterview,
  submitMockAnswer,
  fetchMyCV,
  type MockInterviewResponse,
  type MockAnswerResponse,
  type AnswerEvaluation,
  type MockQuestion,
} from "@/lib/api";
import { useRequireAuth } from "@/hooks/useRequireAuth";

const ROLES = [
  "ML Engineer",
  "Software Engineer",
  "Data Scientist",
  "Backend Engineer",
  "Frontend Engineer",
  "Product Manager",
  "Data Engineer",
  "DevOps Engineer",
];

const DIFFICULTIES = ["easy", "medium", "hard"];

const DIFF_COLOR: Record<string, string> = {
  easy: "text-green-700 bg-green-50 border-green-200",
  medium: "text-amber-700 bg-amber-50 border-amber-200",
  hard: "text-red-700 bg-red-50 border-red-200",
};

const SCORE_COLOR = (score: number) => {
  if (score >= 8) return "text-green-700 bg-green-50 border-green-200";
  if (score >= 5) return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-red-700 bg-red-50 border-red-200";
};

function TurnProgress({ turn, maxTurns }: { turn: number; maxTurns: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: maxTurns }).map((_, i) => (
        <div
          key={i}
          className={`h-2 rounded-full flex-1 transition-all ${
            i < turn ? "bg-blue-600" : i === turn ? "bg-blue-300" : "bg-gray-200"
          }`}
        />
      ))}
      <span className="text-xs text-gray-400 ml-1 whitespace-nowrap">
        {turn}/{maxTurns}
      </span>
    </div>
  );
}

function EvaluationCard({ evaluation }: { evaluation: AnswerEvaluation }) {
  return (
    <div className="card p-5 space-y-3 bg-gray-50">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-gray-800 text-sm">AI Evaluation</h4>
        <span className={`px-3 py-1 rounded-full text-sm font-bold border ${SCORE_COLOR(evaluation.score)}`}>
          {evaluation.score}/10
        </span>
      </div>
      <p className="text-sm text-gray-700 leading-relaxed">{evaluation.feedback}</p>
      <div className="grid grid-cols-2 gap-3">
        {evaluation.strengths.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-1">Strengths</p>
            <ul className="space-y-0.5">
              {evaluation.strengths.map((s, i) => (
                <li key={i} className="text-xs text-gray-600 flex gap-1.5">
                  <span className="text-green-500 mt-0.5">✓</span>{s}
                </li>
              ))}
            </ul>
          </div>
        )}
        {evaluation.gaps.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-1">Gaps</p>
            <ul className="space-y-0.5">
              {evaluation.gaps.map((g, i) => (
                <li key={i} className="text-xs text-gray-600 flex gap-1.5">
                  <span className="text-red-400 mt-0.5">✗</span>{g}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function QuestionCard({
  question,
  turn,
  maxTurns,
  difficulty,
}: {
  question: MockQuestion;
  turn: number;
  maxTurns: number;
  difficulty: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Question {turn}
        </span>
        {question.difficulty && (
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${DIFF_COLOR[question.difficulty] || DIFF_COLOR[difficulty]}`}>
            {question.difficulty}
          </span>
        )}
        {question.focus_area && (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium border bg-blue-50 text-blue-700 border-blue-200">
            {question.focus_area}
          </span>
        )}
      </div>
      <div className="p-4 bg-white border border-gray-200 rounded-xl">
        <p className="text-gray-900 font-medium leading-relaxed text-base">
          {question.question}
        </p>
      </div>
      {question.follow_ups?.length > 0 && (
        <div className="pl-4 border-l-2 border-gray-200 space-y-1">
          <p className="text-xs text-gray-400 font-medium">Possible follow-ups:</p>
          {question.follow_ups.map((fq, i) => (
            <p key={i} className="text-xs text-gray-500 italic">{fq}</p>
          ))}
        </div>
      )}
    </div>
  );
}

type SessionState = "configuring" | "answering" | "evaluating" | "complete";

interface Turn {
  question: MockQuestion;
  answer: string;
  evaluation: AnswerEvaluation;
}

export default function MockPage() {
  useRequireAuth();
  const { toast } = useAppToast();
  const [sessionState, setSessionState] = useState<SessionState>("configuring");

  // Config
  const [role, setRole] = useState("ML Engineer");
  const [customRole, setCustomRole] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [maxTurns] = useState(5);

  // Session data
  const [sessionId, setSessionId] = useState("");
  const [cvContext, setCvContext] = useState<string | undefined>();
  const [currentQuestion, setCurrentQuestion] = useState<MockQuestion | null>(null);
  const [currentTurn, setCurrentTurn] = useState(1);
  const [answer, setAnswer] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [lastEvaluation, setLastEvaluation] = useState<AnswerEvaluation | null>(null);
  const [finalSummary, setFinalSummary] = useState<string | null>(null);

  // Loading
  const [loading, setLoading] = useState(false);
  const [hasCV, setHasCV] = useState<boolean | null>(null);

  useEffect(() => {
    fetchMyCV()
      .then(() => setHasCV(true))
      .catch(() => setHasCV(false));
  }, []);

  const targetRole = role === "Custom" ? customRole.trim() : role;

  const handleStart = async () => {
    if (!targetRole) { toast("Please specify a role.", "error"); return; }
    setLoading(true);
    try {
      const res = await startMockInterview("", targetRole, difficulty) as MockInterviewResponse;
      setSessionId(res.session_id);
      setCvContext(res.cv_context || undefined);
      setCurrentQuestion(res.question);
      setCurrentTurn(1);
      setTurns([]);
      setAnswer("");
      setLastEvaluation(null);
      setFinalSummary(null);
      setSessionState("answering");
    } catch {
      toast("Failed to start mock interview. Check backend connection.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!answer.trim()) { toast("Please write your answer first.", "error"); return; }
    if (!currentQuestion) return;
    setLoading(true);
    setSessionState("evaluating");
    try {
      const res: MockAnswerResponse = await submitMockAnswer(
        targetRole,
        difficulty,
        currentQuestion.question,
        answer,
        currentTurn,
        maxTurns,
        cvContext,
      );

      // Record this turn
      const completedTurn: Turn = {
        question: currentQuestion,
        answer,
        evaluation: res.evaluation,
      };
      setTurns((prev) => [...prev, completedTurn]);
      setLastEvaluation(res.evaluation);
      setAnswer("");

      if (res.is_complete) {
        setFinalSummary(res.final_summary || null);
        setSessionState("complete");
      } else {
        setCurrentQuestion(res.next_question!);
        setCurrentTurn(res.turn);
        setSessionState("answering");
      }
    } catch {
      toast("Failed to evaluate answer.", "error");
      setSessionState("answering");
    } finally {
      setLoading(false);
    }
  };

  const handleRestart = () => {
    setSessionState("configuring");
    setTurns([]);
    setCurrentQuestion(null);
    setLastEvaluation(null);
    setFinalSummary(null);
    setAnswer("");
  };

  // ── Render: Configure ───────────────────────────────────────────────────────
  if (sessionState === "configuring") {
    return (
      <>
        <Head><title>Mock Interview — Interview Note Agent</title></Head>
        <Layout title="Mock Interview">
          <div className="space-y-5 max-w-md">
            {hasCV === true && (
              <div className="inline-flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                <span>✓</span>
                <span><strong>CV detected</strong> — questions will be tailored to your background</span>
              </div>
            )}
            {hasCV === false && (
              <div className="inline-flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                <span>💡</span>
                <span>
                  <a href="/cv" className="font-medium underline">Upload your CV</a> for personalized questions
                </span>
              </div>
            )}

            <div className="card p-6 space-y-5">
              <h3 className="font-semibold text-gray-900">Configure Session</h3>
              <div>
                <label className="label">Target Role</label>
                <select
                  className="input"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  disabled={loading}
                >
                  {ROLES.map((r) => <option key={r}>{r}</option>)}
                  <option value="Custom">Custom...</option>
                </select>
                {role === "Custom" && (
                  <input
                    type="text"
                    className="input mt-2"
                    placeholder="Enter role name..."
                    value={customRole}
                    onChange={(e) => setCustomRole(e.target.value)}
                    disabled={loading}
                  />
                )}
              </div>

              <div>
                <label className="label">Difficulty</label>
                <div className="flex gap-2">
                  {DIFFICULTIES.map((d) => (
                    <button
                      type="button"
                      key={d}
                      onClick={() => setDifficulty(d)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border capitalize transition-colors ${
                        difficulty === d
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                      }`}
                      disabled={loading}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-500 flex items-center gap-2">
                <span>🎯</span>
                <span>{maxTurns} questions · AI evaluates each answer · Final summary at end</span>
              </div>

              <button
                onClick={handleStart}
                className="btn-primary w-full"
                disabled={loading || !targetRole}
              >
                {loading ? "Generating first question..." : "Start Mock Interview"}
              </button>
            </div>
          </div>
        </Layout>
      </>
    );
  }

  // ── Render: Complete ────────────────────────────────────────────────────────
  if (sessionState === "complete") {
    const avgScore = turns.length > 0
      ? Math.round(turns.reduce((sum, t) => sum + t.evaluation.score, 0) / turns.length * 10) / 10
      : 0;

    return (
      <>
        <Head><title>Mock Interview — Interview Note Agent</title></Head>
        <Layout title="Mock Interview — Complete">
          <div className="max-w-2xl space-y-6">
            {/* Summary card */}
            <div className="card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 text-lg">Interview Complete!</h3>
                  <p className="text-sm text-gray-500">{targetRole} · {difficulty} · {turns.length} questions</p>
                </div>
                <div className={`px-4 py-2 rounded-xl text-xl font-bold border-2 ${SCORE_COLOR(avgScore)}`}>
                  {avgScore}/10
                </div>
              </div>

              {finalSummary && (
                <div className="p-4 bg-gray-50 rounded-xl text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                  {finalSummary}
                </div>
              )}

              <button onClick={handleRestart} className="btn-primary w-full">
                Start New Session
              </button>
            </div>

            {/* Turn history */}
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Question History</h4>
              {turns.map((t, i) => (
                <div key={i} className="card p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <p className="font-medium text-gray-800 text-sm flex-1">{t.question.question}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${SCORE_COLOR(t.evaluation.score)}`}>
                      {t.evaluation.score}/10
                    </span>
                  </div>
                  <div className="pl-8 space-y-2">
                    <p className="text-xs text-gray-500 font-medium">Your answer:</p>
                    <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded-lg">{t.answer}</p>
                    <p className="text-xs text-gray-500 italic">{t.evaluation.feedback}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Layout>
      </>
    );
  }

  // ── Render: Answering / Evaluating ──────────────────────────────────────────
  return (
    <>
      <Head><title>Mock Interview — Interview Note Agent</title></Head>
      <Layout title={`Mock Interview — ${targetRole}`}>
        <div className="max-w-2xl space-y-5">
          {/* Progress */}
          <div className="card p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span className="font-medium">{targetRole}</span>
              <span className="capitalize">{difficulty}</span>
            </div>
            <TurnProgress turn={currentTurn - 1} maxTurns={maxTurns} />
          </div>

          {/* Previous turn evaluation (shown after submitting) */}
          {lastEvaluation && turns.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Previous Answer Evaluation</p>
              <EvaluationCard evaluation={lastEvaluation} />
            </div>
          )}

          {/* Current question */}
          {currentQuestion && (
            <div className="card p-5 space-y-4">
              <QuestionCard
                question={currentQuestion}
                turn={currentTurn}
                maxTurns={maxTurns}
                difficulty={difficulty}
              />

              <div className="space-y-2">
                <label className="label">Your Answer</label>
                <textarea
                  className="input min-h-[160px] resize-y text-sm"
                  placeholder="Type your answer here... Be thorough and specific."
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  disabled={loading}
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">{answer.length} characters</span>
                  <button
                    onClick={handleSubmitAnswer}
                    className="btn-primary px-6"
                    disabled={loading || !answer.trim()}
                  >
                    {loading
                      ? sessionState === "evaluating"
                        ? "Evaluating..."
                        : "Processing..."
                      : currentTurn >= maxTurns
                      ? "Submit Final Answer"
                      : "Submit Answer →"}
                  </button>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleRestart}
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            ← End Session
          </button>
        </div>
      </Layout>
    </>
  );
}
