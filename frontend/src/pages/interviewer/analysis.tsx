import { useState } from "react";
import Head from "next/head";
import Layout, { useAppToast } from "@/components/layout/Layout";
import { useRequireRole } from "@/hooks/useRequireAuth";
import { api } from "@/lib/api";

interface AnalyzeResponse {
  answer: string;
  matched_candidates?: Array<{
    candidate_id: string;
    name: string;
    experience_years?: number;
    potential_level?: string;
  }>;
  reasoning?: string;
}

const EXAMPLE_QUERIES = [
  "Top 5 candidates for Lead AI Engineer",
  "Who has more than 10 years of experience?",
  "Candidates with Python and Kubernetes skills",
  "High potential candidates not yet contacted",
  "Compare the top 3 candidates for Senior ML role",
];

export default function AIAnalysisPage() {
  useRequireRole("interviewer");
  const { toast } = useAppToast();

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [history, setHistory] = useState<Array<{ query: string; answer: string }>>([]);

  const handleAnalyze = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await api.post<AnalyzeResponse>("/candidates/analyze", { query });
      setResult(res.data);
      setHistory((prev) => [{ query, answer: res.data.answer }, ...prev]);
      setQuery("");
    } catch (err: any) {
      toast(err?.response?.data?.detail || "Analysis failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const POTENTIAL_COLOR: Record<string, string> = {
    High: "bg-green-900/50 text-green-400",
    Medium: "bg-yellow-900/50 text-yellow-400",
    Low: "bg-gray-700 text-gray-400",
  };

  return (
    <>
      <Head>
        <title>AI Candidate Intelligence — Interviewer</title>
      </Head>
      <Layout>
        <div className="p-6 max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-white mb-2">AI Candidate Intelligence</h1>
          <p className="text-gray-400 text-sm mb-6">
            Ask natural language questions about your candidate pool.
          </p>

          {/* Query Input */}
          <div className="flex gap-3 mb-4">
            <input
              type="text"
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ask about candidates..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
            />
            <button
              onClick={handleAnalyze}
              disabled={loading || !query.trim()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Analyzing..." : "Ask"}
            </button>
          </div>

          {/* Example queries */}
          <div className="flex flex-wrap gap-2 mb-6">
            {EXAMPLE_QUERIES.map((eq) => (
              <button
                key={eq}
                onClick={() => setQuery(eq)}
                className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-full text-xs text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
              >
                {eq}
              </button>
            ))}
          </div>

          {/* Result */}
          {result && (
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6">
              <p className="text-white whitespace-pre-wrap mb-4">{result.answer}</p>

              {result.matched_candidates && result.matched_candidates.length > 0 && (
                <div className="border-t border-gray-700 pt-4">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Matched Candidates</p>
                  <div className="space-y-2">
                    {result.matched_candidates.map((c) => (
                      <div key={c.candidate_id} className="flex items-center gap-3 bg-gray-900 rounded-lg p-3">
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white">
                          {c.name?.[0]?.toUpperCase() ?? "?"}
                        </div>
                        <div className="flex-1">
                          <p className="text-white text-sm font-medium">{c.name}</p>
                          {c.experience_years != null && (
                            <p className="text-xs text-gray-400">{c.experience_years} years exp</p>
                          )}
                        </div>
                        {c.potential_level && (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${POTENTIAL_COLOR[c.potential_level] || "bg-gray-700 text-gray-400"}`}>
                            {c.potential_level}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.reasoning && (
                <div className="border-t border-gray-700 pt-4 mt-4">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Reasoning</p>
                  <p className="text-sm text-gray-300">{result.reasoning}</p>
                </div>
              )}
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Previous Queries</p>
              <div className="space-y-3">
                {history.map((h, i) => (
                  <div key={i} className="bg-gray-800/50 rounded-lg border border-gray-700/50 p-4">
                    <p className="text-xs text-blue-400 mb-1">Q: {h.query}</p>
                    <p className="text-sm text-gray-300 line-clamp-3">{h.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Layout>
    </>
  );
}
