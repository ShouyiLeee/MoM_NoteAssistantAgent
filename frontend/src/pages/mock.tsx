import { useState } from "react";
import Head from "next/head";
import Layout, { useAppToast } from "@/components/layout/Layout";
import { startMockInterview, type MockInterviewResponse } from "@/lib/api";
import { getUserId } from "@/lib/user";

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

function SessionView({ session }: { session: MockInterviewResponse }) {
  const [answer, setAnswer] = useState("");
  const { question } = session;

  const diffColor: Record<string, string> = {
    easy: "text-green-700 bg-green-50 border-green-200",
    medium: "text-amber-700 bg-amber-50 border-amber-200",
    hard: "text-red-700 bg-red-50 border-red-200",
  };

  return (
    <div className="card p-6 space-y-5 max-w-2xl">
      <div className="flex items-center gap-3">
        <span className="text-2xl">🎯</span>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">Mock Interview Session</h3>
          <p className="text-xs text-gray-400">Session ID: {session.session_id}</p>
        </div>
        <div className="flex gap-2">
          {question.difficulty && (
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                diffColor[question.difficulty] || "text-gray-700 bg-gray-50 border-gray-200"
              }`}
            >
              {question.difficulty}
            </span>
          )}
          {question.focus_area && (
            <span className="px-2.5 py-1 rounded-full text-xs font-medium border bg-blue-50 text-blue-700 border-blue-200">
              {question.focus_area}
            </span>
          )}
        </div>
      </div>

      {/* Main question */}
      <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Question</p>
        <p className="text-gray-900 font-medium leading-relaxed">{question.question}</p>
      </div>

      {/* Follow-ups */}
      {question.follow_ups?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Follow-up Questions
          </p>
          <ol className="space-y-2">
            {question.follow_ups.map((fq, i) => (
              <li key={i} className="flex gap-2 text-sm text-gray-700">
                <span className="w-5 h-5 bg-blue-100 text-blue-700 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                {fq}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Answer scratchpad */}
      <div>
        <label className="label">Your Answer (scratchpad)</label>
        <textarea
          className="input min-h-[120px] resize-y text-sm"
          placeholder="Draft your answer here before speaking..."
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
        />
      </div>

      <p className="text-xs text-gray-400 italic">{session.message}</p>
    </div>
  );
}

function MockForm({ onStart }: { onStart: (res: MockInterviewResponse) => void }) {
  const { toast } = useAppToast();
  const [role, setRole] = useState("ML Engineer");
  const [customRole, setCustomRole] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [loading, setLoading] = useState(false);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetRole = role === "Custom" ? customRole.trim() : role;
    if (!targetRole) {
      toast("Please specify a role.", "error");
      return;
    }
    setLoading(true);
    try {
      const uid = getUserId();
      const res = await startMockInterview(uid, targetRole, difficulty);
      onStart(res);
    } catch {
      toast("Failed to start mock interview. Check backend connection.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleStart} className="card p-6 space-y-5 max-w-md">
      <h3 className="font-semibold text-gray-900">Configure Session</h3>

      <div>
        <label className="label">Target Role</label>
        <select
          className="input"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          disabled={loading}
        >
          {ROLES.map((r) => (
            <option key={r}>{r}</option>
          ))}
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

      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? "Generating question..." : "Start Mock Interview"}
      </button>
    </form>
  );
}

export default function MockPage() {
  const [session, setSession] = useState<MockInterviewResponse | null>(null);

  return (
    <>
      <Head>
        <title>Mock Interview — Interview Note Agent</title>
      </Head>
      <Layout title="Mock Interview">
        <div className="space-y-6">
          <p className="text-sm text-gray-500 max-w-lg">
            The AI generates a targeted question based on your past interview weaknesses retrieved
            via RAG.
          </p>
          <MockForm onStart={setSession} />
          {session && <SessionView session={session} />}
        </div>
      </Layout>
    </>
  );
}
