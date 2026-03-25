import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Layout from "@/components/layout/Layout";
import { useRequireRole } from "@/hooks/useRequireAuth";
import { api } from "@/lib/api";

interface CandidateDetail {
  candidate_id: string;
  name: string;
  role?: string;
  skills: string[];
  experience_years?: number;
  education?: string;
  recent_roles?: string[];
  cv_summary?: string;
  potential_level?: string;
  status?: string;
  notes?: string;
  created_at?: string;
}

const POTENTIAL_COLOR: Record<string, string> = {
  High: "bg-green-900/50 text-green-400",
  Medium: "bg-yellow-900/50 text-yellow-400",
  Low: "bg-gray-700 text-gray-400",
};

const STATUS_OPTIONS = ["applied", "shortlisted", "interviewed", "offered", "rejected"];

export default function CandidateDetailPage() {
  useRequireRole("interviewer");
  const router = useRouter();
  const { id } = router.query;

  const [candidate, setCandidate] = useState<CandidateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.get(`/candidates/${id}`)
      .then((res) => {
        const data = res.data?.profile || res.data;
        setCandidate(data);
        setStatus(data.status || "applied");
        setNotes(data.notes || "");
      })
      .catch(() => setCandidate(null))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await api.put(`/candidates/${id}`, { status, notes });
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  if (loading) {
    return (
      <Layout>
        <div className="p-6">
          <p className="text-gray-400">Loading candidate...</p>
        </div>
      </Layout>
    );
  }

  if (!candidate) {
    return (
      <Layout>
        <div className="p-6">
          <p className="text-red-400">Candidate not found.</p>
        </div>
      </Layout>
    );
  }

  return (
    <>
      <Head>
        <title>{candidate.name || "Candidate"} — Interviewer</title>
      </Head>
      <Layout>
        <div className="p-6 max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">{candidate.name}</h1>
              <p className="text-gray-400">{candidate.role || "—"}</p>
            </div>
            <div className="flex gap-2">
              {candidate.potential_level && (
                <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${POTENTIAL_COLOR[candidate.potential_level]}`}>
                  {candidate.potential_level} Potential
                </span>
              )}
            </div>
          </div>

          {/* Overview Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
              <p className="text-xs text-gray-400 mb-1">Experience</p>
              <p className="text-xl font-bold text-white">{candidate.experience_years ?? "—"} years</p>
            </div>
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
              <p className="text-xs text-gray-400 mb-1">Education</p>
              <p className="text-sm text-white">{candidate.education || "—"}</p>
            </div>
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
              <p className="text-xs text-gray-400 mb-1">Imported</p>
              <p className="text-sm text-white">{candidate.created_at ? new Date(candidate.created_at).toLocaleDateString() : "—"}</p>
            </div>
          </div>

          {/* Skills */}
          {candidate.skills.length > 0 && (
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Skills</p>
              <div className="flex flex-wrap gap-2">
                {candidate.skills.map((s) => (
                  <span key={s} className="px-3 py-1 bg-blue-900/30 text-blue-400 rounded-full text-sm">{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* Recent Roles */}
          {candidate.recent_roles && candidate.recent_roles.length > 0 && (
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Recent Roles</p>
              <ul className="space-y-1">
                {candidate.recent_roles.map((r, i) => (
                  <li key={i} className="text-sm text-gray-300">• {r}</li>
                ))}
              </ul>
            </div>
          )}

          {/* CV Summary */}
          {candidate.cv_summary && (
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">CV Summary</p>
              <p className="text-sm text-gray-300 whitespace-pre-wrap">{candidate.cv_summary}</p>
            </div>
          )}

          {/* Status & Notes */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 space-y-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Status & Notes</p>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-500 disabled:opacity-40"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full h-24 bg-gray-700 border border-gray-600 rounded-lg p-3 text-sm text-white resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Add notes about this candidate..."
              />
            </div>
          </div>

          <button onClick={() => router.back()} className="text-sm text-gray-400 hover:text-white">
            ← Back to Candidate CV
          </button>
        </div>
      </Layout>
    </>
  );
}
