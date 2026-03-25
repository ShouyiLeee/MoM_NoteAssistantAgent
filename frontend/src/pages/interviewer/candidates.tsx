import { useEffect, useState } from "react";
import Layout from "@/components/layout/Layout";
import { useRequireRole } from "@/hooks/useRequireAuth";
import { listCandidates, CandidateProfile } from "@/lib/api";

export default function CandidatesPage() {
  useRequireRole("interviewer");
  const [candidates, setCandidates] = useState<CandidateProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [skillsFilter, setSkillsFilter] = useState("");
  const [minExp, setMinExp] = useState("");
  const [maxExp, setMaxExp] = useState("");

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const data = await listCandidates({
        search: search || undefined,
        skills: skillsFilter || undefined,
        min_experience: minExp ? parseInt(minExp) : undefined,
        max_experience: maxExp ? parseInt(maxExp) : undefined,
      });
      setCandidates(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCandidates();
  };

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-white">Candidates</h1>

        {/* Filters */}
        <form onSubmit={handleSearch} className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="col-span-2 md:col-span-1">
              <label className="block text-xs text-gray-400 mb-1">Search</label>
              <input
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name or role..."
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Skills</label>
              <input
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white"
                value={skillsFilter}
                onChange={(e) => setSkillsFilter(e.target.value)}
                placeholder="e.g. Python, React"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Min Exp (yrs)</label>
              <input
                type="number"
                min={0}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white"
                value={minExp}
                onChange={(e) => setMinExp(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Max Exp (yrs)</label>
              <input
                type="number"
                min={0}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white"
                value={maxExp}
                onChange={(e) => setMaxExp(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              Filter
            </button>
          </div>
        </form>

        {/* List */}
        {loading ? (
          <p className="text-gray-400">Loading candidates...</p>
        ) : candidates.length === 0 ? (
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center">
            <p className="text-gray-400">No candidates found.</p>
            <p className="text-gray-500 text-sm mt-1">
              Candidates appear here once they upload a CV as Interviewee.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {candidates.map((c) => (
              <a
                key={c.user_id}
                href={`/interviewer/candidates/${c.user_id}`}
                className="block bg-gray-800 hover:bg-gray-750 rounded-xl border border-gray-700 p-4 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-white">
                        {c.name || "Unknown Candidate"}
                      </h3>
                      {c.experience_years != null && (
                        <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">
                          {c.experience_years} yrs exp
                        </span>
                      )}
                    </div>
                    {c.education && (
                      <p className="text-xs text-gray-400 mt-0.5">{c.education}</p>
                    )}
                    {c.recent_roles.length > 0 && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {c.recent_roles.slice(0, 2).join(", ")}
                      </p>
                    )}
                    {c.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {c.skills.slice(0, 6).map((s) => (
                          <span
                            key={s}
                            className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full"
                          >
                            {s}
                          </span>
                        ))}
                        {c.skills.length > 6 && (
                          <span className="text-xs text-gray-500">+{c.skills.length - 6}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-blue-400 shrink-0">View →</span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
