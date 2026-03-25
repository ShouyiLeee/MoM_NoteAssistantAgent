import { useEffect, useState } from "react";
import Layout from "@/components/layout/Layout";
import { useRequireRole } from "@/hooks/useRequireAuth";
import { fetchInterviewerAnalytics, InterviewerAnalytics } from "@/lib/api";

export default function InterviewerDashboard() {
  useRequireRole("interviewer");
  const [analytics, setAnalytics] = useState<InterviewerAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInterviewerAnalytics()
      .then(setAnalytics)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-white">Interviewer Dashboard</h1>

        {loading ? (
          <p className="text-gray-400">Loading analytics...</p>
        ) : analytics ? (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total JDs", value: analytics.total_jds },
                { label: "Active JDs", value: analytics.active_jds },
                { label: "Candidates Scored", value: analytics.total_candidates_scored },
                { label: "Question Sets", value: analytics.total_question_sets },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                  <p className="text-xs text-gray-400 mb-1">{label}</p>
                  <p className="text-3xl font-bold text-white">{value}</p>
                </div>
              ))}
            </div>

            {/* Avg fit score */}
            {analytics.avg_fit_score != null && (
              <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex items-center gap-4">
                <div>
                  <p className="text-xs text-gray-400">Average Fit Score</p>
                  <p className="text-2xl font-bold text-blue-400">
                    {(analytics.avg_fit_score * 100).toFixed(0)}%
                  </p>
                </div>
                {analytics.top_jd_title && (
                  <div className="ml-8">
                    <p className="text-xs text-gray-400">Most Active JD</p>
                    <p className="text-sm font-medium text-white">{analytics.top_jd_title}</p>
                  </div>
                )}
              </div>
            )}

            {/* Recent scores */}
            {analytics.recent_scores.length > 0 && (
              <div className="bg-gray-800 rounded-xl border border-gray-700">
                <div className="px-4 py-3 border-b border-gray-700">
                  <h2 className="text-sm font-semibold text-white">Recent Candidate Scores</h2>
                </div>
                <div className="divide-y divide-gray-700">
                  {analytics.recent_scores.map((s, i) => (
                    <div key={i} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">{s.candidate_name || "Unknown"}</p>
                        <p className="text-xs text-gray-500">JD {s.jd_id.slice(0, 8)}</p>
                      </div>
                      <span
                        className={`text-sm font-bold ${
                          s.fit_score >= 0.7
                            ? "text-green-400"
                            : s.fit_score >= 0.4
                            ? "text-yellow-400"
                            : "text-red-400"
                        }`}
                      >
                        {(s.fit_score * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick links */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { href: "/interviewer/candidate-cv", label: "Candidate CV", icon: "👥" },
                { href: "/interviewer/analysis", label: "AI Candidate Intelligence", icon: "🤖" },
                { href: "/interviewer/jd", label: "Job Descriptions", icon: "📋" },
                { href: "/interviewer/interviews", label: "Interview Notes", icon: "📝" },
                { href: "/interviewer/question-bank", label: "Question Bank", icon: "❓" },
              ].map(({ href, label, icon }) => (
                <a
                  key={href}
                  href={href}
                  className="bg-gray-800 hover:bg-gray-700 rounded-xl p-4 border border-gray-700 transition-colors flex items-center gap-3"
                >
                  <span className="text-2xl">{icon}</span>
                  <span className="text-sm font-medium text-white">{label}</span>
                </a>
              ))}
            </div>
          </>
        ) : (
          <p className="text-gray-400">No data available.</p>
        )}
      </div>
    </Layout>
  );
}
