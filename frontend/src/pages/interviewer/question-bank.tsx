import { useEffect, useState } from "react";
import Layout from "@/components/layout/Layout";
import { useRequireRole } from "@/hooks/useRequireAuth";
import { listQuestionSets, deleteQuestionSet, listJDs, QuestionSetResponse, JDResponse } from "@/lib/api";

export default function QuestionBankPage() {
  useRequireRole("interviewer");
  const [sets, setSets] = useState<QuestionSetResponse[]>([]);
  const [jds, setJDs] = useState<Record<string, JDResponse>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listQuestionSets(), listJDs()])
      .then(([qSets, jdList]) => {
        setSets(qSets);
        const jdMap: Record<string, JDResponse> = {};
        jdList.forEach((j) => (jdMap[j.id] = j));
        setJDs(jdMap);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this question set?")) return;
    await deleteQuestionSet(id);
    setSets((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Question Bank</h1>
          <p className="text-sm text-gray-400">
            Generate questions from a JD page
          </p>
        </div>

        {loading ? (
          <p className="text-gray-400">Loading...</p>
        ) : sets.length === 0 ? (
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center">
            <p className="text-gray-400">No question sets yet.</p>
            <p className="text-gray-500 text-sm mt-1">
              Go to a Job Description and click "Generate Questions".
            </p>
            <a
              href="/interviewer/jd"
              className="inline-block mt-3 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              View Job Descriptions
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {sets.map((qs) => {
              const jd = jds[qs.jd_id];
              const isOpen = expanded === qs.id;
              return (
                <div key={qs.id} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                  <div className="p-4 flex items-center justify-between gap-4">
                    <button
                      onClick={() => setExpanded(isOpen ? null : qs.id)}
                      className="flex-1 text-left"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-white">
                          {jd ? `${jd.title} — ${jd.company}` : `JD ${qs.jd_id.slice(0, 8)}`}
                        </h3>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            qs.difficulty === "hard"
                              ? "bg-red-900 text-red-300"
                              : qs.difficulty === "medium"
                              ? "bg-yellow-900 text-yellow-300"
                              : "bg-green-900 text-green-300"
                          }`}
                        >
                          {qs.difficulty}
                        </span>
                        <span className="text-xs text-gray-500">
                          {qs.questions.length} questions
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Generated {new Date(qs.generated_at).toLocaleDateString()}
                      </p>
                    </button>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => setExpanded(isOpen ? null : qs.id)}
                        className="text-xs text-gray-400 hover:text-white"
                      >
                        {isOpen ? "Collapse ▲" : "Expand ▼"}
                      </button>
                      <button
                        onClick={() => handleDelete(qs.id)}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="border-t border-gray-700 divide-y divide-gray-700">
                      {qs.questions.map((q, i) => (
                        <div key={i} className="px-4 py-3 space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm text-white flex-1">
                              {i + 1}. {q.question}
                            </p>
                            <div className="flex gap-1 shrink-0">
                              <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">
                                {q.focus_area}
                              </span>
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full ${
                                  q.difficulty === "hard"
                                    ? "bg-red-900 text-red-300"
                                    : q.difficulty === "medium"
                                    ? "bg-yellow-900 text-yellow-300"
                                    : "bg-green-900 text-green-300"
                                }`}
                              >
                                {q.difficulty}
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-gray-400">{q.rubric}</p>
                          {q.expected_points.length > 0 && (
                            <ul className="text-xs text-gray-300 pl-4 space-y-0.5">
                              {q.expected_points.map((pt, j) => (
                                <li key={j} className="list-disc">{pt}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
