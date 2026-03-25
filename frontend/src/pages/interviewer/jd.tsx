import { useEffect, useState } from "react";
import Layout from "@/components/layout/Layout";
import { useRequireRole } from "@/hooks/useRequireAuth";
import { listJDs, createJD, deleteJD, JDResponse, JDCreateRequest } from "@/lib/api";

type FormState = {
  title: string;
  company: string;
  experience_level: string;
  skills_input: string;
  raw_text: string;
};

const EMPTY_FORM: FormState = {
  title: "",
  company: "",
  experience_level: "",
  skills_input: "",
  raw_text: "",
};

export default function JDListPage() {
  useRequireRole("interviewer");
  const [jds, setJDs] = useState<JDResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    listJDs()
      .then(setJDs)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.company || !form.raw_text) {
      setError("Title, company, and JD text are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const req: JDCreateRequest = {
        title: form.title,
        company: form.company,
        experience_level: form.experience_level || undefined,
        skills_required: form.skills_input
          ? form.skills_input.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        raw_text: form.raw_text,
      };
      const jd = await createJD(req);
      setJDs((prev) => [jd, ...prev]);
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to create JD");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this job description?")) return;
    await deleteJD(id);
    setJDs((prev) => prev.filter((j) => j.id !== id));
  };

  return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Job Descriptions</h1>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            {showForm ? "Cancel" : "+ New JD"}
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={handleCreate}
            className="bg-gray-800 rounded-xl border border-gray-700 p-5 space-y-4"
          >
            <h2 className="text-sm font-semibold text-white">New Job Description</h2>
            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Job Title *</label>
                <input
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Senior Backend Engineer"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Company *</label>
                <input
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white"
                  value={form.company}
                  onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                  placeholder="e.g. Acme Corp"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Experience Level</label>
                <select
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white"
                  value={form.experience_level}
                  onChange={(e) => setForm((f) => ({ ...f, experience_level: e.target.value }))}
                >
                  <option value="">Any</option>
                  <option value="Junior">Junior</option>
                  <option value="Mid">Mid</option>
                  <option value="Senior">Senior</option>
                  <option value="Lead">Lead</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Required Skills (comma-separated)</label>
                <input
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white"
                  value={form.skills_input}
                  onChange={(e) => setForm((f) => ({ ...f, skills_input: e.target.value }))}
                  placeholder="e.g. Python, FastAPI, PostgreSQL"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Job Description Text *</label>
              <textarea
                rows={8}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white resize-none"
                value={form.raw_text}
                onChange={(e) => setForm((f) => ({ ...f, raw_text: e.target.value }))}
                placeholder="Paste the full job description here..."
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium"
              >
                {saving ? "Saving..." : "Create JD"}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="text-gray-400">Loading...</p>
        ) : jds.length === 0 ? (
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center">
            <p className="text-gray-400">No job descriptions yet.</p>
            <p className="text-gray-500 text-sm mt-1">Click "+ New JD" to create your first one.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {jds.map((jd) => (
              <div
                key={jd.id}
                className="bg-gray-800 rounded-xl border border-gray-700 p-4 flex items-start justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-white">{jd.title}</h3>
                    {jd.experience_level && (
                      <span className="text-xs bg-blue-900 text-blue-300 px-2 py-0.5 rounded-full">
                        {jd.experience_level}
                      </span>
                    )}
                    {!jd.is_active && (
                      <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{jd.company}</p>
                  {jd.skills_required.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {jd.skills_required.slice(0, 5).map((s) => (
                        <span
                          key={s}
                          className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full"
                        >
                          {s}
                        </span>
                      ))}
                      {jd.skills_required.length > 5 && (
                        <span className="text-xs text-gray-500">
                          +{jd.skills_required.length - 5} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <a
                    href={`/interviewer/jd/${jd.id}`}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium"
                  >
                    Open
                  </a>
                  <button
                    onClick={() => handleDelete(jd.id)}
                    className="bg-gray-700 hover:bg-red-800 text-gray-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
