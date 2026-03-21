import { useEffect, useState } from "react";
import Head from "next/head";
import Layout from "@/components/layout/Layout";
import { fetchHistory, type InterviewSummary } from "@/lib/api";
import { getUserId } from "@/lib/user";

const RESULT_BADGE: Record<string, string> = {
  Pass: "bg-green-100 text-green-700",
  Fail: "bg-red-100 text-red-700",
  Pending: "bg-amber-100 text-amber-700",
};

function InterviewRow({ iv }: { iv: InterviewSummary }) {
  const [expanded, setExpanded] = useState(false);
  const badge = RESULT_BADGE[iv.result ?? ""] || "bg-gray-100 text-gray-600";

  return (
    <div className="card p-4 hover:shadow-md transition-shadow">
      <div
        className="flex items-center gap-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 truncate">
            {iv.company || "Unknown"} — {iv.role || "Unknown Role"}
          </p>
          <p className="text-sm text-gray-400">
            {iv.stage || "—"} · {iv.date || "No date"}
          </p>
        </div>
        {iv.result && (
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${badge}`}>
            {iv.result}
          </span>
        )}
        <span className="text-gray-400 text-sm">{expanded ? "▴" : "▾"}</span>
      </div>
      {expanded && iv.feedback && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Feedback</p>
          <p className="text-sm text-gray-700">{iv.feedback}</p>
        </div>
      )}
    </div>
  );
}

export default function HistoryPage() {
  const [all, setAll] = useState<InterviewSummary[]>([]);
  const [filtered, setFiltered] = useState<InterviewSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [resultFilter, setResultFilter] = useState("All");
  const [error, setError] = useState("");

  useEffect(() => {
    const uid = getUserId();
    fetchHistory(uid)
      .then((data) => {
        setAll(data.interviews);
        setFiltered(data.interviews);
      })
      .catch(() => setError("Failed to load interview history. Make sure the backend is running."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let list = all;
    if (resultFilter !== "All") {
      list = list.filter((iv) => iv.result === resultFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (iv) =>
          iv.company?.toLowerCase().includes(q) ||
          iv.role?.toLowerCase().includes(q) ||
          iv.stage?.toLowerCase().includes(q) ||
          iv.feedback?.toLowerCase().includes(q)
      );
    }
    setFiltered(list);
  }, [search, resultFilter, all]);

  return (
    <>
      <Head>
        <title>History — Interview Note Agent</title>
      </Head>
      <Layout title="Interview History">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <input
            type="text"
            className="input max-w-xs"
            placeholder="Search company, role, stage..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex gap-2">
            {["All", "Pass", "Fail", "Pending"].map((r) => (
              <button
                key={r}
                onClick={() => setResultFilter(r)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  resultFilter === r
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <p className="self-center text-sm text-gray-400 ml-auto">
            {filtered.length} interview{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse bg-gray-200 rounded-xl h-16" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card p-12 text-center text-gray-400">
            <p className="text-4xl mb-2">📋</p>
            <p className="font-medium">
              {all.length === 0 ? "No interviews recorded yet." : "No matches found."}
            </p>
            {all.length === 0 && (
              <p className="text-sm mt-1">Upload your first interview note to get started.</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((iv) => (
              <InterviewRow key={iv.id} iv={iv} />
            ))}
          </div>
        )}
      </Layout>
    </>
  );
}
