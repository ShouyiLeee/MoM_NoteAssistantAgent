import { useEffect, useState } from "react";
import Head from "next/head";
import Layout, { useAppToast } from "@/components/layout/Layout";
import FileUploadZone from "@/components/cv/FileUploadZone";
import {
  uploadInterview,
  uploadInterviewFile,
  fetchHistory,
  type InterviewUploadResponse,
  type InterviewSummary,
} from "@/lib/api";
import { getUserId } from "@/lib/user";
import { useRequireAuth } from "@/hooks/useRequireAuth";

type Tab = "new" | "history";

const RESULT_BADGE: Record<string, string> = {
  Pass: "bg-green-100 text-green-700",
  Fail: "bg-red-100 text-red-700",
  Pending: "bg-amber-100 text-amber-700",
};

const RESULT_COLOR: Record<string, string> = {
  Pass: "text-green-700 bg-green-50 border-green-200",
  Fail: "text-red-700 bg-red-50 border-red-200",
  Pending: "text-amber-700 bg-amber-50 border-amber-200",
};

/* ── Upload Result Card ──────────────────────────────────────────────── */
function ResultCard({ data }: { data: InterviewUploadResponse }) {
  const { extracted } = data;
  const rc = RESULT_COLOR[extracted.result ?? ""] || "text-gray-700 bg-gray-50 border-gray-200";
  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white">Extracted Interview Data</h3>
        {extracted.result && (
          <span className={`px-3 py-1 rounded-full text-sm font-medium border ${rc}`}>{extracted.result}</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        {[
          ["Company", extracted.company],
          ["Role", extracted.role],
          ["Stage", extracted.stage],
          ["Date", extracted.date],
        ].map(([label, val]) => (
          <div key={label as string}>
            <p className="text-gray-400 text-xs">{label}</p>
            <p className="text-white">{val || "—"}</p>
          </div>
        ))}
      </div>
      {extracted.feedback && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <p className="text-gray-400 text-xs mb-1">Feedback</p>
          <p className="text-white text-sm whitespace-pre-wrap">{extracted.feedback}</p>
        </div>
      )}
    </div>
  );
}

/* ── History Row ─────────────────────────────────────────────────────── */
function InterviewRow({ iv }: { iv: InterviewSummary }) {
  const [expanded, setExpanded] = useState(false);
  const badge = RESULT_BADGE[iv.result ?? ""] || "bg-gray-700 text-gray-300";
  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 hover:border-gray-600 transition-colors">
      <div className="flex items-center gap-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-white truncate">
            {iv.company || "Unknown"} — {iv.role || "Unknown Role"}
          </p>
          <p className="text-sm text-gray-400">
            {iv.stage || "—"} · {iv.date || "No date"}
          </p>
        </div>
        {iv.result && (
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${badge}`}>{iv.result}</span>
        )}
        <span className="text-gray-400 text-sm">{expanded ? "▴" : "▾"}</span>
      </div>
      {expanded && iv.feedback && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Feedback</p>
          <p className="text-sm text-gray-300">{iv.feedback}</p>
        </div>
      )}
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────────────────── */
export default function InterviewsPage() {
  useRequireAuth();
  const { toast } = useAppToast();
  const [tab, setTab] = useState<Tab>("new");

  // Upload state
  const [uploadMode, setUploadMode] = useState<"text" | "file">("text");
  const [rawNotes, setRawNotes] = useState("");
  const [jdText, setJdText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<InterviewUploadResponse | null>(null);

  // History state
  const [all, setAll] = useState<InterviewSummary[]>([]);
  const [filtered, setFiltered] = useState<InterviewSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [resultFilter, setResultFilter] = useState("All");

  const loadHistory = () => {
    setHistoryLoading(true);
    const uid = getUserId();
    fetchHistory(uid)
      .then((data) => {
        setAll(data.interviews);
        setFiltered(data.interviews);
      })
      .catch(() => toast("Failed to load history", "error"))
      .finally(() => setHistoryLoading(false));
  };

  useEffect(() => {
    if (tab === "history") loadHistory();
  }, [tab]);

  // Filter history
  useEffect(() => {
    let list = all;
    if (resultFilter !== "All") list = list.filter((iv) => iv.result === resultFilter);
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

  const handleUpload = async () => {
    setUploading(true);
    setUploadResult(null);
    try {
      let res: InterviewUploadResponse;
      if (uploadMode === "file" && selectedFile) {
        res = await uploadInterviewFile(selectedFile, jdText || undefined);
      } else {
        const uid = getUserId();
        res = await uploadInterview(uid, rawNotes, jdText || undefined);
      }
      setUploadResult(res);
      toast("Interview uploaded successfully!", "success");
      setRawNotes("");
      setSelectedFile(null);
    } catch (err: any) {
      toast(err?.response?.data?.detail || "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Interviews — Interview Note Agent</title>
      </Head>
      <Layout>
        <div className="p-6 max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-white mb-6">Interviews</h1>

          {/* Tabs */}
          <div className="flex gap-1 bg-gray-800 rounded-lg p-1 mb-6 w-fit">
            {[
              { key: "new" as Tab, label: "New Note" },
              { key: "history" as Tab, label: "History" },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  tab === t.key ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ── New Note Tab ─────────────────────────────────────────── */}
          {tab === "new" && (
            <div className="space-y-4">
              {/* Upload mode toggle */}
              <div className="flex gap-2">
                {(["text", "file"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setUploadMode(m)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      uploadMode === m
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-gray-800 text-gray-400 border-gray-700 hover:border-blue-400"
                    }`}
                  >
                    {m === "text" ? "Paste Text" : "Upload File"}
                  </button>
                ))}
              </div>

              {uploadMode === "text" ? (
                <textarea
                  className="w-full h-48 bg-gray-800 border border-gray-700 rounded-xl p-4 text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Paste your interview notes here..."
                  value={rawNotes}
                  onChange={(e) => setRawNotes(e.target.value)}
                />
              ) : (
                <FileUploadZone
                  accept=".pdf,.docx,.doc"
                  label="Drop interview note file (PDF/DOCX)"
                  onFile={setSelectedFile}
                />
              )}

              <details className="text-sm">
                <summary className="text-gray-400 cursor-pointer hover:text-white">Optional: Add JD text</summary>
                <textarea
                  className="w-full h-24 mt-2 bg-gray-800 border border-gray-700 rounded-xl p-3 text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Paste job description for better context..."
                  value={jdText}
                  onChange={(e) => setJdText(e.target.value)}
                />
              </details>

              <button
                onClick={handleUpload}
                disabled={uploading || (uploadMode === "text" ? !rawNotes.trim() : !selectedFile)}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {uploading ? "Processing..." : "Upload & Extract"}
              </button>

              {uploadResult && <ResultCard data={uploadResult} />}
            </div>
          )}

          {/* ── History Tab ──────────────────────────────────────────── */}
          {tab === "history" && (
            <div>
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3 mb-5">
                <input
                  type="text"
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm max-w-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                          : "bg-gray-800 text-gray-400 border-gray-700 hover:border-blue-400"
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

              {historyLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse bg-gray-800 rounded-xl h-16" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-12 text-center text-gray-400">
                  <p className="text-4xl mb-2">📋</p>
                  <p className="font-medium">
                    {all.length === 0 ? "No interviews recorded yet." : "No matches found."}
                  </p>
                  {all.length === 0 && (
                    <p className="text-sm mt-1">
                      Switch to &quot;New Note&quot; tab to upload your first interview note.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {filtered.map((iv) => (
                    <InterviewRow key={iv.id} iv={iv} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Layout>
    </>
  );
}
