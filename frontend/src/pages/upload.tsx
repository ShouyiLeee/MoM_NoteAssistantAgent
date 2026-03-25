import { useState } from "react";
import Head from "next/head";
import Layout, { useAppToast } from "@/components/layout/Layout";
import FileUploadZone from "@/components/cv/FileUploadZone";
import { uploadInterview, uploadInterviewFile, type InterviewUploadResponse } from "@/lib/api";
import { getUserId } from "@/lib/user";
import { useRequireAuth } from "@/hooks/useRequireAuth";

type UploadTab = "text" | "file";

const RESULT_COLOR: Record<string, string> = {
  Pass: "text-green-700 bg-green-50 border-green-200",
  Fail: "text-red-700 bg-red-50 border-red-200",
  Pending: "text-amber-700 bg-amber-50 border-amber-200",
};

function ResultCard({ data }: { data: InterviewUploadResponse }) {
  const { extracted } = data;
  const resultClass = RESULT_COLOR[extracted.result ?? ""] || "text-gray-700 bg-gray-50 border-gray-200";

  return (
    <div className="card p-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Extracted Interview Data</h3>
        {extracted.result && (
          <span className={`px-3 py-1 rounded-full text-sm font-medium border ${resultClass}`}>
            {extracted.result}
          </span>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        {[
          ["Company", extracted.company],
          ["Role", extracted.role],
          ["Stage", extracted.stage],
          ["Date", extracted.date],
        ].map(([k, v]) => (
          <div key={String(k)}>
            <dt className="text-gray-500 font-medium">{k}</dt>
            <dd className="text-gray-900 mt-0.5">{v || "—"}</dd>
          </div>
        ))}
        {extracted.feedback && (
          <div className="col-span-2">
            <dt className="text-gray-500 font-medium">Feedback</dt>
            <dd className="text-gray-900 mt-0.5">{extracted.feedback}</dd>
          </div>
        )}
      </dl>
      <p className="mt-4 text-xs text-gray-400 italic">{data.message}</p>
    </div>
  );
}

function UploadForm() {
  const { toast } = useAppToast();
  const [activeTab, setActiveTab] = useState<UploadTab>("text");
  const [notes, setNotes] = useState("");
  const [jd, setJd] = useState("");
  const [showJd, setShowJd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InterviewUploadResponse | null>(null);

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notes.trim()) { toast("Please enter your interview notes.", "error"); return; }
    setLoading(true);
    setResult(null);
    try {
      const uid = getUserId();
      const res = await uploadInterview(uid, notes, showJd ? jd : undefined);
      setResult(res);
      toast("Interview uploaded successfully!", "success");
    } catch {
      toast("Upload failed. Check that the backend is running.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    setLoading(true);
    setResult(null);
    try {
      const res = await uploadInterviewFile(file, showJd ? jd : undefined);
      setResult(res);
      toast("Interview uploaded successfully!", "success");
    } catch {
      toast("File upload failed. Ensure the file is a DOCX or TXT.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {(["text", "file"] as UploadTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
              activeTab === tab ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab === "text" ? "📝 Paste Text" : "📁 Upload File"}
          </button>
        ))}
      </div>

      {activeTab === "text" ? (
        <form onSubmit={handleTextSubmit} className="space-y-4">
          <div>
            <label className="label">Interview Notes <span className="text-red-500">*</span></label>
            <textarea
              className="input min-h-[180px] resize-y font-mono text-sm"
              placeholder={`Example:\nInterview with Google — ML Engineer role\nStage: Coding round\n\nQuestion: Design an LRU Cache...\nResult: Failed — struggled with time complexity`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-gray-400 mt-1">{notes.length} characters</p>
          </div>
          <JDSection showJd={showJd} jd={jd} setShowJd={setShowJd} setJd={setJd} loading={loading} />
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Processing with AI..." : "Upload & Extract"}
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <FileUploadZone
            accept=".docx,.doc,.txt"
            onFile={handleFileUpload}
            isLoading={loading}
            label="Drop your interview notes file here (DOCX or TXT)"
          />
          <JDSection showJd={showJd} jd={jd} setShowJd={setShowJd} setJd={setJd} loading={loading} />
        </div>
      )}

      {result && <ResultCard data={result} />}
    </div>
  );
}

function JDSection({
  showJd, jd, setShowJd, setJd, loading,
}: {
  showJd: boolean; jd: string;
  setShowJd: (v: boolean) => void; setJd: (v: string) => void; loading: boolean;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={() => setShowJd(!showJd)}
        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
      >
        {showJd ? "▾ Hide" : "▸ Add"} Job Description (optional)
      </button>
      {showJd && (
        <textarea
          className="input mt-2 min-h-[100px] resize-y text-sm"
          placeholder="Paste the job description to improve extraction accuracy..."
          value={jd}
          onChange={(e) => setJd(e.target.value)}
          disabled={loading}
        />
      )}
    </div>
  );
}

export default function UploadPage() {
  useRequireAuth();
  return (
    <>
      <Head><title>Upload Interview — Interview Note Agent</title></Head>
      <Layout title="Upload Interview Notes">
        <div className="max-w-2xl">
          <p className="text-sm text-gray-500 mb-6">
            Upload your interview notes as text or a file (DOCX/TXT). The AI will extract
            company, role, stage, result, and feedback automatically.
          </p>
          <UploadForm />
        </div>
      </Layout>
    </>
  );
}
