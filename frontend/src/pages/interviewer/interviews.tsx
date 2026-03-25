import { useEffect, useState } from "react";
import Head from "next/head";
import Layout, { useAppToast } from "@/components/layout/Layout";
import { useRequireRole } from "@/hooks/useRequireAuth";
import { api } from "@/lib/api";

type Tab = "upload" | "history";

interface CandidateInterviewNote {
  id: string;
  candidate_name?: string;
  company?: string;
  role?: string;
  stage?: string;
  result?: string;
  feedback?: string;
  date?: string;
}

const RESULT_BADGE: Record<string, string> = {
  Pass: "bg-green-900/50 text-green-400",
  Fail: "bg-red-900/50 text-red-400",
  Pending: "bg-amber-900/50 text-amber-400",
};

export default function InterviewerInterviewsPage() {
  useRequireRole("interviewer");
  const { toast } = useAppToast();
  const [tab, setTab] = useState<Tab>("upload");

  // Upload state
  const [rawNotes, setRawNotes] = useState("");
  const [candidateName, setCandidateName] = useState("");
  const [role, setRole] = useState("");
  const [stage, setStage] = useState("General");
  const [uploading, setUploading] = useState(false);

  // History state
  const [notes, setNotes] = useState<CandidateInterviewNote[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await api.get("/interviews/history");
      setNotes(res.data.interviews || []);
    } catch {
      toast("Failed to load interview notes", "error");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "history") loadHistory();
  }, [tab]);

  const handleUpload = async () => {
    if (!rawNotes.trim()) return;
    setUploading(true);
    try {
      await api.post("/interviews/upload", {
        raw_notes: rawNotes,
        user_id: "interviewer", // will be overridden by JWT in auth-enforced mode
      });
      toast("Interview note saved!", "success");
      setRawNotes("");
      setCandidateName("");
      setRole("");
    } catch (err: any) {
      toast(err?.response?.data?.detail || "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Interview Notes — Interviewer</title>
      </Head>
      <Layout>
        <div className="p-6 max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-white mb-6">Interview Notes</h1>

          {/* Tabs */}
          <div className="flex gap-1 bg-gray-800 rounded-lg p-1 mb-6 w-fit">
            {[
              { key: "upload" as Tab, label: "Upload Note" },
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

          {tab === "upload" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Candidate Name</label>
                  <input
                    type="text"
                    value={candidateName}
                    onChange={(e) => setCandidateName(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. John Doe"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Role</label>
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Senior ML Engineer"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Stage</label>
                  <select
                    value={stage}
                    onChange={(e) => setStage(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {["General", "Coding", "System Design", "Behavioral", "HR"].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <textarea
                className="w-full h-48 bg-gray-800 border border-gray-700 rounded-xl p-4 text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Write your notes about this candidate's interview performance..."
                value={rawNotes}
                onChange={(e) => setRawNotes(e.target.value)}
              />

              <button
                onClick={handleUpload}
                disabled={uploading || !rawNotes.trim()}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {uploading ? "Saving..." : "Save Note"}
              </button>
            </div>
          )}

          {tab === "history" && (
            <div>
              {historyLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse bg-gray-800 rounded-xl h-16" />
                  ))}
                </div>
              ) : notes.length === 0 ? (
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-12 text-center text-gray-400">
                  <p className="text-4xl mb-2">📝</p>
                  <p className="font-medium">No interview notes yet.</p>
                  <p className="text-sm mt-1">Switch to &quot;Upload Note&quot; to add your first note.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notes.map((note) => (
                    <div key={note.id} className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                      <div className="flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white truncate">
                            {note.company || "—"} — {note.role || "—"}
                          </p>
                          <p className="text-sm text-gray-400">
                            {note.stage || "—"} · {note.date || "No date"}
                          </p>
                        </div>
                        {note.result && (
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${RESULT_BADGE[note.result] || "bg-gray-700 text-gray-300"}`}>
                            {note.result}
                          </span>
                        )}
                      </div>
                      {note.feedback && (
                        <p className="mt-2 text-sm text-gray-300 line-clamp-2">{note.feedback}</p>
                      )}
                    </div>
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
