import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/layout/Layout";
import { useRequireRole } from "@/hooks/useRequireAuth";
import { getCandidate, CandidateDetailResponse } from "@/lib/api";

export default function CandidateDetailPage() {
  useRequireRole("interviewer");
  const router = useRouter();
  const { id } = router.query as { id: string };

  const [detail, setDetail] = useState<CandidateDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getCandidate(id)
      .then(setDetail)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <Layout>
        <div className="p-6">
          <p className="text-gray-400">Loading...</p>
        </div>
      </Layout>
    );
  }

  if (!detail) {
    return (
      <Layout>
        <div className="p-6">
          <p className="text-red-400">Candidate not found.</p>
        </div>
      </Layout>
    );
  }

  const { profile, scores } = detail;

  return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <button
          onClick={() => router.push("/interviewer/candidates")}
          className="text-xs text-gray-400 hover:text-white"
        >
          ← Back to Candidates
        </button>

        {/* Profile header */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
          <h1 className="text-xl font-bold text-white">
            {profile.name || "Unknown Candidate"}
          </h1>
          {profile.education && (
            <p className="text-sm text-gray-400 mt-0.5">{profile.education}</p>
          )}
          {profile.experience_years != null && (
            <p className="text-sm text-gray-400">{profile.experience_years} years experience</p>
          )}

          {profile.summary && (
            <p className="text-sm text-gray-300 mt-3">{profile.summary}</p>
          )}

          {profile.recent_roles.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-gray-500 mb-1">Recent Roles</p>
              <div className="flex flex-wrap gap-1">
                {profile.recent_roles.map((r) => (
                  <span key={r} className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">
                    {r}
                  </span>
                ))}
              </div>
            </div>
          )}

          {profile.skills.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-gray-500 mb-1">Skills</p>
              <div className="flex flex-wrap gap-1">
                {profile.skills.map((s) => (
                  <span key={s} className="text-xs bg-blue-900 text-blue-300 px-2 py-0.5 rounded-full">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Scores section */}
        <div>
          <h2 className="text-sm font-semibold text-white mb-3">JD Fit Scores</h2>
          {scores.length === 0 ? (
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 text-center">
              <p className="text-gray-400 text-sm">
                This candidate has not been scored against any JD yet.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {scores.map((s) => (
                <div
                  key={s.jd_id}
                  className="bg-gray-800 rounded-xl border border-gray-700 p-4 flex items-center justify-between gap-4"
                >
                  <div className="flex-1">
                    <p className="text-xs text-gray-400">JD {s.jd_id.slice(0, 8)}...</p>
                    <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                      {Object.entries(s.score_breakdown).map(([k, v]) => (
                        <div key={k} className="bg-gray-700 rounded-lg px-2 py-1">
                          <span className="text-gray-400 capitalize">{k}: </span>
                          <span className="text-white">
                            {typeof v === "number" ? (v * 100).toFixed(0) : v}%
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(s.scored_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p
                      className={`text-2xl font-bold ${
                        s.fit_score >= 0.7
                          ? "text-green-400"
                          : s.fit_score >= 0.4
                          ? "text-yellow-400"
                          : "text-red-400"
                      }`}
                    >
                      {(s.fit_score * 100).toFixed(0)}%
                    </p>
                    <p className="text-xs text-gray-500">fit</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
