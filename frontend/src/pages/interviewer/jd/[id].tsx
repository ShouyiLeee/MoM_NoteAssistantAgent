import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/layout/Layout";
import { useRequireRole } from "@/hooks/useRequireAuth";
import {
  getJD, listCandidates, matchCandidates, generateQuestions,
  JDResponse, CandidateProfile, RankedCandidate, QuestionSetResponse,
} from "@/lib/api";

export default function JDDetailPage() {
  useRequireRole("interviewer");
  const router = useRouter();
  const { id } = router.query as { id: string };

  const [jd, setJD] = useState<JDResponse | null>(null);
  const [candidates, setCandidates] = useState<CandidateProfile[]>([]);
  const [ranked, setRanked] = useState<RankedCandidate[]>([]);
  const [questionSet, setQuestionSet] = useState<QuestionSetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [matching, setMatching] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [tab, setTab] = useState<"candidates" | "questions">("candidates");

  useEffect(() => {
    if (!id) return;
    Promise.all([getJD(id), listCandidates()])
      .then(([jdData, candidateData]) => {
        setJD(jdData);
        setCandidates(candidateData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const handleMatchCandidates = async () => {
    if (!id || candidates.length === 0) return;
    setMatching(true);
    try {
      const result = await matchCandidates(
        id,
        candidates.map((c) => c.user_id)
      );
      setRanked(result.ranked_candidates);
    } catch (err) {
      console.error(err);
    } finally {
      setMatching(false);
    }
  };

  const handleGenerateQuestions = async () => {
    if (!id) return;
    setGenerating(true);
    try {
      const qs = await generateQuestions(id, "medium", 10);
      setQuestionSet(qs);
      setTab("questions");
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="p-6">
          <p className="text-gray-400">Loading...</p>
        </div>
      </Layout>
    );
  }

  if (!jd) {
    return (
      <Layout>
        <div className="p-6">
          <p className="text-red-400">Job Description not found.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <button
              onClick={() => router.push("/interviewer/jd")}
              className="text-xs text-gray-400 hover:text-white mb-2 block"
            >
              ← Back to JDs
            </button>
            <h1 className="text-2xl font-bold text-white">{jd.title}</h1>
            <p className="text-gray-400">{jd.company}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={handleMatchCandidates}
              disabled={matching || candidates.length === 0}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              {matching ? "Matching..." : `Match ${candidates.length} Candidates`}
            </button>
            <button
              onClick={handleGenerateQuestions}
              disabled={generating}
              className="bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              {generating ? "Generating..." : "Generate Questions"}
            </button>
          </div>
        </div>

        {/* JD info */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <div className="flex flex-wrap gap-2 mb-3">
            {jd.experience_level && (
              <span className="text-xs bg-blue-900 text-blue-300 px-2 py-0.5 rounded-full">
                {jd.experience_level}
              </span>
            )}
            {jd.skills_required.map((s) => (
              <span key={s} className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">
                {s}
              </span>
            ))}
          </div>
          <p className="text-sm text-gray-300 whitespace-pre-wrap line-clamp-6">{jd.raw_text}</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          {(["candidates", "questions"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t
                  ? "border-blue-500 text-white"
                  : "border-transparent text-gray-400 hover:text-white"
              }`}
            >
              {t === "candidates"
                ? `Ranked Candidates (${ranked.length})`
                : `Questions (${questionSet?.questions.length ?? 0})`}
            </button>
          ))}
        </div>

        {/* Candidates tab */}
        {tab === "candidates" && (
          <div>
            {ranked.length === 0 ? (
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center">
                <p className="text-gray-400">No candidates ranked yet.</p>
                <p className="text-gray-500 text-sm mt-1">
                  Click "Match Candidates" to score all candidates against this JD.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {ranked.map((c, i) => (
                  <div
                    key={c.cv_id}
                    className="bg-gray-800 rounded-xl border border-gray-700 p-4 flex items-start gap-4"
                  >
                    <div className="text-2xl font-bold text-gray-500 w-8 shrink-0">
                      #{i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-white">
                          {c.candidate_name}
                        </h3>
                        <span
                          className={`text-sm font-bold shrink-0 ${
                            c.fit_score >= 0.7
                              ? "text-green-400"
                              : c.fit_score >= 0.4
                              ? "text-yellow-400"
                              : "text-red-400"
                          }`}
                        >
                          {(c.fit_score * 100).toFixed(0)}% fit
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{c.recommendation}</p>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                        {Object.entries(c.score_breakdown).map(([k, v]) => (
                          <div key={k} className="bg-gray-700 rounded-lg px-2 py-1">
                            <span className="text-gray-400 capitalize">{k}: </span>
                            <span className="text-white">{((v as number) * 100).toFixed(0)}%</span>
                          </div>
                        ))}
                      </div>
                      {c.strengths.length > 0 && (
                        <p className="text-xs text-green-400 mt-2">
                          ✓ {c.strengths.slice(0, 2).join(" · ")}
                        </p>
                      )}
                      {c.gaps.length > 0 && (
                        <p className="text-xs text-red-400 mt-0.5">
                          ✗ {c.gaps.slice(0, 2).join(" · ")}
                        </p>
                      )}
                    </div>
                    <a
                      href={`/interviewer/candidates/${c.cv_id}`}
                      className="shrink-0 text-xs text-blue-400 hover:text-blue-300"
                    >
                      View →
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Questions tab */}
        {tab === "questions" && (
          <div>
            {!questionSet ? (
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center">
                <p className="text-gray-400">No question bank generated yet.</p>
                <p className="text-gray-500 text-sm mt-1">
                  Click "Generate Questions" to create a question bank for this JD.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {questionSet.questions.map((q, i) => (
                  <div
                    key={i}
                    className="bg-gray-800 rounded-xl border border-gray-700 p-4 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-white flex-1">
                        {i + 1}. {q.question}
                      </p>
                      <div className="flex gap-1 shrink-0">
                        <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">
                          {q.focus_area}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            q.difficulty === "hard"
                              ? "bg-red-900 text-red-300"
                              : q.difficulty === "medium"
                              ? "bg-yellow-900 text-yellow-300"
                              : "bg-green-900 text-green-300"
                          }`}
                        >
                          {q.difficulty}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400">{q.rubric}</p>
                    {q.expected_points.length > 0 && (
                      <ul className="text-xs text-gray-300 space-y-0.5 pl-4">
                        {q.expected_points.map((pt, j) => (
                          <li key={j} className="list-disc">{pt}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
