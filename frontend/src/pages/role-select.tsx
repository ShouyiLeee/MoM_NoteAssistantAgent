import { useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

const ROLES = [
  {
    id: "interviewee",
    title: "I'm looking for a job",
    subtitle: "Track interview performance, analyze weaknesses, practice mock interviews",
    icon: "🎯",
    features: ["Upload interview notes", "AI performance analysis", "Mock interview practice", "CV upload & insights"],
  },
  {
    id: "interviewer",
    title: "I'm hiring candidates",
    subtitle: "Manage job descriptions, review candidates, generate question banks",
    icon: "🏢",
    features: ["Manage job descriptions", "Candidate pipeline", "AI candidate matching", "Interview question bank"],
  },
];

export default function RoleSelectPage() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleRole = (roleId: string) => {
    setSelected((prev) =>
      prev.includes(roleId) ? prev.filter((r) => r !== roleId) : [...prev, roleId]
    );
  };

  const handleSubmit = async () => {
    if (selected.length === 0) return;
    setIsSubmitting(true);
    try {
      await api.put("/auth/roles", { roles: selected });
      await refreshUser();
      router.replace("/");
    } catch {
      alert("Failed to save role. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome{user?.name ? `, ${user.name.split(" ")[0]}` : ""}!
          </h1>
          <p className="text-gray-500">How will you use Interview Note? You can select both.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {ROLES.map((role) => {
            const isActive = selected.includes(role.id);
            return (
              <button
                key={role.id}
                onClick={() => toggleRole(role.id)}
                className={`text-left rounded-2xl border-2 p-6 transition-all ${
                  isActive
                    ? "border-blue-600 bg-blue-50"
                    : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <div className="text-4xl mb-3">{role.icon}</div>
                <h2 className={`text-lg font-semibold mb-1 ${isActive ? "text-blue-700" : "text-gray-900"}`}>
                  {role.title}
                </h2>
                <p className="text-sm text-gray-500 mb-4">{role.subtitle}</p>
                <ul className="space-y-1">
                  {role.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-blue-500" : "bg-gray-300"}`} />
                      {f}
                    </li>
                  ))}
                </ul>
                {isActive && (
                  <div className="mt-4 flex items-center gap-1 text-blue-600 text-sm font-medium">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Selected
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <button
          onClick={handleSubmit}
          disabled={selected.length === 0 || isSubmitting}
          className="w-full btn-primary py-3 text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Saving..." : "Get Started →"}
        </button>
      </div>
    </div>
  );
}
