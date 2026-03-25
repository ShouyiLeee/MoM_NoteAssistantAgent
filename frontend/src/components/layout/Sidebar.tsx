import Link from "next/link";
import { useRouter } from "next/router";
import clsx from "clsx";
import { useAuth } from "@/contexts/AuthContext";

const INTERVIEWEE_NAV = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/interviews", label: "Interviews", icon: "📝" },
  { href: "/cv", label: "My CV", icon: "📄" },
  { href: "/analysis", label: "AI Analysis", icon: "🔍" },
  { href: "/mock", label: "Mock Interview", icon: "🎯" },
];

const INTERVIEWER_NAV = [
  { href: "/interviewer", label: "Dashboard", icon: "📊" },
  { href: "/interviewer/interviews", label: "Interviews", icon: "📝" },
  { href: "/interviewer/candidate-cv", label: "Candidate CV", icon: "👥" },
  { href: "/interviewer/analysis", label: "AI Analysis", icon: "🤖" },
  { href: "/interviewer/jd", label: "Job Descriptions", icon: "📋" },
  { href: "/interviewer/question-bank", label: "Question Bank", icon: "❓" },
];

export default function Sidebar() {
  const router = useRouter();
  const { user, isInterviewee, isInterviewer, logout } = useAuth();

  // Determine active role view from current path
  const isInterviewerView = router.pathname.startsWith("/interviewer");
  const navItems = isInterviewerView ? INTERVIEWER_NAV : INTERVIEWEE_NAV;

  return (
    <aside className="w-60 min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-800">
        <h1 className="text-lg font-bold text-white leading-tight">
          Interview
          <span className="text-blue-400"> Note</span>
        </h1>
        <p className="text-xs text-gray-400 mt-0.5">AI Intelligence System</p>
      </div>

      {/* Role switcher — only visible if user has both roles */}
      {isInterviewee && isInterviewer && (
        <div className="px-3 py-3 border-b border-gray-800">
          <div className="flex rounded-lg bg-gray-800 p-1 text-xs font-medium">
            <Link
              href="/"
              className={clsx(
                "flex-1 text-center py-1.5 rounded-md transition-colors",
                !isInterviewerView
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-white"
              )}
            >
              Interviewee
            </Link>
            <Link
              href="/interviewer"
              className={clsx(
                "flex-1 text-center py-1.5 rounded-md transition-colors",
                isInterviewerView
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-white"
              )}
            >
              Interviewer
            </Link>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const active =
            item.href === "/" || item.href === "/interviewer"
              ? router.pathname === item.href
              : router.pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              )}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User + logout */}
      <div className="px-4 py-4 border-t border-gray-800">
        {user ? (
          <div className="flex items-center gap-2">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt="" className="w-7 h-7 rounded-full" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">
                {user.name?.[0]?.toUpperCase() ?? "U"}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{user.name}</p>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
            </div>
            <button
              onClick={logout}
              className="text-gray-500 hover:text-white transition-colors text-xs"
              title="Logout"
            >
              ⎋
            </button>
          </div>
        ) : (
          <Link href="/login" className="text-xs text-gray-500 hover:text-white">
            Sign in
          </Link>
        )}
      </div>
    </aside>
  );
}
