import { useState } from "react";
import Head from "next/head";
import Layout, { useAppToast } from "@/components/layout/Layout";
import { uploadInterview, type InterviewUploadResponse } from "@/lib/api";
import { getUserId } from "@/lib/user";

function ResultCard({ data }: { data: InterviewUploadResponse }) {
  const { extracted } = data;
  const RESULT_COLOR: Record<string, string> = {
    Pass: "text-green-700 bg-green-50 border-green-200",
    Fail: "text-red-700 bg-red-50 border-red-200",
    Pending: "text-amber-700 bg-amber-50 border-amber-200",
  };
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
          <div key={k}>
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
  const [notes, setNotes] = useState("");
  const [jd, setJd] = useState("");
  const [showJd, setShowJd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InterviewUploadResponse | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notes.trim()) {
      toast("Please enter your interview notes.", "error");
      return;
    }
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

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
      <div>
        <label className="label">
          Interview Notes <span className="text-red-500">*</span>
        </label>
        <textarea
          className="input min-h-[180px] resize-y font-mono text-sm"
          placeholder={`Example:\nInterview with Google — ML Engineer role\nStage: Coding round\n\nQuestion: Design an LRU Cache...\nResult: Failed — struggled with time complexity explanation`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={loading}
        />
        <p className="text-xs text-gray-400 mt-1">{notes.length} characters</p>
      </div>

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
            className="input mt-2 min-h-[120px] resize-y text-sm"
            placeholder="Paste the job description here to improve extraction accuracy..."
            value={jd}
            onChange={(e) => setJd(e.target.value)}
            disabled={loading}
          />
        )}
      </div>

      <button type="submit" className="btn-primary" disabled={loading}>
        {loading ? "Processing with AI..." : "Upload & Extract"}
      </button>
    </form>
  );
}

export default function UploadPage() {
  return (
    <>
      <Head>
        <title>Upload Interview — Interview Note Agent</title>
      </Head>
      <Layout title="Upload Interview Notes">
        <div className="max-w-2xl">
          <p className="text-sm text-gray-500 mb-6">
            Paste your raw interview notes. The AI will extract structured data including company,
            role, stage, result, and feedback automatically.
          </p>
          <UploadForm />
        </div>
      </Layout>
    </>
  );
}
