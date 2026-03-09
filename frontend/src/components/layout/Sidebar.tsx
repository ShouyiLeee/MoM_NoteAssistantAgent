import Link from "next/link";
import { useRouter } from "next/router";
import clsx from "clsx";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/upload", label: "Upload Interview", icon: "📝" },
  { href: "/cv", label: "My CV", icon: "📄" },
  { href: "/analysis", label: "AI Analysis", icon: "🔍" },
  { href: "/mock", label: "Mock Interview", icon: "🎯" },
  { href: "/history", label: "History", icon: "📋" },
];

export default function Sidebar() {
  const router = useRouter();

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

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? router.pathname === "/"
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

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-800">
        <p className="text-xs text-gray-500">Interview Note Agent v0.2</p>
      </div>
    </aside>
  );
}
