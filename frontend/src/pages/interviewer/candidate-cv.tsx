import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import Layout, { useAppToast } from "@/components/layout/Layout";
import FileUploadZone from "@/components/cv/FileUploadZone";
import { useRequireRole } from "@/hooks/useRequireAuth";
import { api } from "@/lib/api";

/* ── Types ───────────────────────────────────────────────────────────── */
interface CandidateCV {
  candidate_id: string;
  name: string;
  role?: string;
  skills: string[];
  experience_years?: number;
  education?: string;
  potential_level?: string;
  status?: string;
  cv_summary?: string;
  created_at?: string;
}

interface ImportPreview {
  name: string;
  role: string;
  skills: string[];
  experience_years: number | null;
  education: string;
  cv_summary: string;
  potential_level: string;
  raw_text: string;
}

/* ── Constants ───────────────────────────────────────────────────────── */
const POTENTIAL_COLOR: Record<string, string> = {
  High: "bg-green-900/50 text-green-400 border-green-800",
  Medium: "bg-yellow-900/50 text-yellow-400 border-yellow-800",
  Low: "bg-gray-700 text-gray-400 border-gray-600",
};

const STATUS_COLOR: Record<string, string> = {
  applied: "bg-blue-900/50 text-blue-400",
  shortlisted: "bg-purple-900/50 text-purple-400",
  interviewed: "bg-amber-900/50 text-amber-400",
  offered: "bg-green-900/50 text-green-400",
  rejected: "bg-red-900/50 text-red-400",
};

type SortKey = "potential_level" | "experience_years" | "created_at";

export default function CandidateCVPage() {
  useRequireRole("interviewer");
  const { toast } = useAppToast();

  // List state
  const [candidates, setCandidates] = useState<CandidateCV[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [skillsFilter, setSkillsFilter] = useState("");
  const [minExp, setMinExp] = useState("");
  const [maxExp, setMaxExp] = useState("");
  const [potentialFilter, setPotentialFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("potential_level");

  // Import modal
  const [showImport, setShowImport] = useState(false);
  const [importStep, setImportStep] = useState<"upload" | "preview" | "saving">("upload");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);

  /* ── Fetch candidates ──────────────────────────────────────────────── */
  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const res = await api.get("/candidates", {
        params: {
          search: search || undefined,
          skills: skillsFilter || undefined,
          min_experience: minExp ? parseInt(minExp) : undefined,
          max_experience: maxExp ? parseInt(maxExp) : undefined,
          potential_level: potentialFilter.length > 0 ? potentialFilter.join(",") : undefined,
          status: statusFilter || undefined,
          sort: sortBy,
        },
      });
      setCandidates(res.data);
    } catch {
      toast("Failed to load candidates", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCandidates(); }, []);

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCandidates();
  };

  /* ── Import flow ───────────────────────────────────────────────────── */
  const handleImportUpload = async () => {
    if (!importFile) return;
    setImportStep("preview");
    try {
      const form = new FormData();
      form.append("file", importFile);
      const res = await api.post("/candidates/import/file", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setImportPreview(res.data);
    } catch (err: any) {
      toast(err?.response?.data?.detail || "Failed to extract CV", "error");
      setImportStep("upload");
    }
  };

  const handleImportConfirm = async () => {
    if (!importPreview) return;
    setImportStep("saving");
    try {
      await api.post("/candidates", importPreview);
      toast("Candidate imported!", "success");
      setShowImport(false);
      setImportStep("upload");
      setImportFile(null);
      setImportPreview(null);
      fetchCandidates();
    } catch (err: any) {
      toast(err?.response?.data?.detail || "Failed to save candidate", "error");
      setImportStep("preview");
    }
  };

  const togglePotential = (level: string) => {
    setPotentialFilter((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]
    );
  };

  return (
    <>
      <Head>
        <title>Candidate CV — Interviewer</title>
      </Head>
      <Layout>
        <div className="p-6 max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-white">Candidate CV</h1>
            <button
              onClick={() => { setShowImport(true); setImportStep("upload"); setImportFile(null); setImportPreview(null); }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-500 transition-colors"
            >
              + Import CV
            </button>
          </div>

          {/* ── Import Modal ───────────────────────────────────────── */}
          {showImport && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
              <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-white">Import Candidate CV</h2>
                  <button onClick={() => setShowImport(false)} className="text-gray-400 hover:text-white text-xl">&times;</button>
                </div>

                {importStep === "upload" && (
                  <div className="space-y-4">
                    <FileUploadZone accept=".pdf,.docx,.doc" label="Drop candidate CV (PDF/DOCX)" onFile={setImportFile} />
                    <button
                      onClick={handleImportUpload}
                      disabled={!importFile}
                      className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Extract & Analyze
                    </button>
                  </div>
                )}

                {importStep === "preview" && !importPreview && (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
                    <p className="ml-3 text-gray-400">Analyzing CV...</p>
                  </div>
                )}

                {importStep === "preview" && importPreview && (
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-gray-400">Name</p>
                        <p className="text-white">{importPreview.name || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Role</p>
                        <p className="text-white">{importPreview.role || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Experience</p>
                        <p className="text-white">{importPreview.experience_years ?? "—"} years</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Potential Level</p>
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${POTENTIAL_COLOR[importPreview.potential_level] || "bg-gray-700 text-gray-400"}`}>
                          {importPreview.potential_level}
                        </span>
                      </div>
                    </div>
                    {importPreview.skills.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Skills</p>
                        <div className="flex flex-wrap gap-1">
                          {importPreview.skills.map((s) => (
                            <span key={s} className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">{s}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {importPreview.cv_summary && (
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Summary</p>
                        <p className="text-sm text-gray-300">{importPreview.cv_summary}</p>
                      </div>
                    )}
                    <button
                      onClick={handleImportConfirm}
                      className="w-full py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-500"
                    >
                      Confirm & Save
                    </button>
                  </div>
                )}

                {importStep === "saving" && (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full" />
                    <p className="ml-3 text-gray-400">Saving candidate...</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-6">
            {/* ── Filter Sidebar ──────────────────────────────────── */}
            <form onSubmit={handleFilter} className="w-64 shrink-0 space-y-4">
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Search</label>
                  <input
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Name, role..."
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Skills</label>
                  <input
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={skillsFilter}
                    onChange={(e) => setSkillsFilter(e.target.value)}
                    placeholder="Python, React..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Min Exp</label>
                    <input
                      type="number" min={0}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      value={minExp}
                      onChange={(e) => setMinExp(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Max Exp</label>
                    <input
                      type="number" min={0}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      value={maxExp}
                      onChange={(e) => setMaxExp(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Potential Level</label>
                  <div className="flex flex-col gap-1">
                    {["High", "Medium", "Low"].map((level) => (
                      <label key={level} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={potentialFilter.includes(level)}
                          onChange={() => togglePotential(level)}
                          className="rounded border-gray-600"
                        />
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${POTENTIAL_COLOR[level]}`}>{level}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Status</label>
                  <select
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="">All</option>
                    {["applied", "shortlisted", "interviewed", "offered", "rejected"].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Sort by</label>
                  <select
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortKey)}
                  >
                    <option value="potential_level">Potential Level</option>
                    <option value="experience_years">Experience</option>
                    <option value="created_at">Import Date</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Apply Filters
                </button>
              </div>
            </form>

            {/* ── Candidate List ──────────────────────────────────── */}
            <div className="flex-1">
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse bg-gray-800 rounded-xl h-24" />
                  ))}
                </div>
              ) : candidates.length === 0 ? (
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-12 text-center text-gray-400">
                  <p className="text-4xl mb-2">👥</p>
                  <p className="font-medium">No candidates found.</p>
                  <p className="text-sm mt-1">Click &quot;Import CV&quot; to add your first candidate.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-400">{candidates.length} candidate{candidates.length !== 1 ? "s" : ""}</p>
                  {candidates.map((c) => (
                    <Link
                      key={c.candidate_id}
                      href={`/interviewer/candidate-cv/${c.candidate_id}`}
                      className="block bg-gray-800 hover:bg-gray-750 rounded-xl border border-gray-700 p-4 transition-colors hover:border-gray-600"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-semibold text-white">{c.name || "Unknown"}</h3>
                            {c.role && <span className="text-xs text-gray-400">· {c.role}</span>}
                            {c.experience_years != null && (
                              <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">{c.experience_years} yrs</span>
                            )}
                          </div>
                          {c.skills.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {c.skills.slice(0, 6).map((s) => (
                                <span key={s} className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">{s}</span>
                              ))}
                              {c.skills.length > 6 && <span className="text-xs text-gray-500">+{c.skills.length - 6}</span>}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          {c.potential_level && (
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${POTENTIAL_COLOR[c.potential_level] || "bg-gray-700 text-gray-400"}`}>
                              {c.potential_level}
                            </span>
                          )}
                          {c.status && (
                            <span className={`px-2 py-1 rounded-full text-xs ${STATUS_COLOR[c.status] || "bg-gray-700 text-gray-400"}`}>
                              {c.status}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </Layout>
    </>
  );
}
