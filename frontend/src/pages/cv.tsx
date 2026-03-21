import { useEffect, useState } from "react";
import Head from "next/head";
import Layout, { useAppToast } from "@/components/layout/Layout";
import { fetchCV, uploadCV, type CVResponse } from "@/lib/api";
import { getUserId } from "@/lib/user";

function CVSummaryCard({ cv }: { cv: CVResponse }) {
  const skills = cv.skills || [];
  const roles = cv.recent_roles || [];

  return (
    <div className="card p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Active CV — Version {cv.version}</h3>
        <span className="text-xs text-gray-400">
          Uploaded {new Date(cv.created_at).toLocaleDateString()}
        </span>
      </div>

      {cv.summary && (
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Summary</p>
          <p className="text-sm text-gray-700">{cv.summary}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 text-sm">
        {cv.experience_years != null && (
          <div className="card p-3 bg-blue-50 border-blue-100">
            <p className="text-xs text-blue-500 font-medium">Experience</p>
            <p className="text-xl font-bold text-blue-700 mt-1">{cv.experience_years} yrs</p>
          </div>
        )}
        {cv.education && (
          <div className="card p-3 bg-purple-50 border-purple-100">
            <p className="text-xs text-purple-500 font-medium">Education</p>
            <p className="font-semibold text-purple-700 mt-1">{cv.education}</p>
          </div>
        )}
      </div>

      {skills.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Skills</p>
          <div className="flex flex-wrap gap-2">
            {skills.map((s) => (
              <span
                key={s}
                className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {roles.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Recent Roles
          </p>
          <ul className="space-y-1">
            {roles.map((r) => (
              <li key={r} className="text-sm text-gray-700 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {cv.change_summary && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs font-medium text-amber-700">Change note</p>
          <p className="text-sm text-amber-600 mt-0.5">{cv.change_summary}</p>
        </div>
      )}
    </div>
  );
}

function UploadCVForm({ onSuccess }: { onSuccess: (cv: CVResponse) => void }) {
  const { toast } = useAppToast();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      toast("Please paste your CV text.", "error");
      return;
    }
    setLoading(true);
    try {
      const uid = getUserId();
      const res = await uploadCV(uid, text);
      onSuccess(res);
      toast(
        res.version > 1
          ? `CV updated — version ${res.version} saved.`
          : "CV uploaded successfully!",
        "success"
      );
      setText("");
    } catch {
      toast("CV upload failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">CV Text</label>
        <textarea
          className="input min-h-[200px] resize-y font-mono text-sm"
          placeholder="Paste your full CV text here. The AI will extract skills, experience, education, and recent roles..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={loading}
        />
        <p className="text-xs text-gray-400 mt-1">
          Duplicate CV versions are automatically deduplicated to save tokens.
        </p>
      </div>
      <button type="submit" className="btn-primary" disabled={loading}>
        {loading ? "Processing CV..." : "Upload CV"}
      </button>
    </form>
  );
}

export default function CVPage() {
  const [cv, setCV] = useState<CVResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const uid = getUserId();
    fetchCV(uid)
      .then(setCV)
      .catch(() => setCV(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Head>
        <title>My CV — Interview Note Agent</title>
      </Head>
      <Layout title="My CV">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">
          {/* Upload section */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-4">Upload / Update CV</h3>
            <UploadCVForm onSuccess={setCV} />
          </div>

          {/* Current CV */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-4">Current Active CV</h3>
            {loading ? (
              <div className="animate-pulse bg-gray-200 rounded-xl h-64" />
            ) : cv ? (
              <CVSummaryCard cv={cv} />
            ) : (
              <div className="card p-8 text-center text-gray-400">
                <p className="text-4xl mb-2">📄</p>
                <p className="text-sm">No CV uploaded yet.</p>
                <p className="text-xs mt-1">Upload your CV to improve interview extraction accuracy.</p>
              </div>
            )}
          </div>
        </div>
      </Layout>
    </>
  );
}
