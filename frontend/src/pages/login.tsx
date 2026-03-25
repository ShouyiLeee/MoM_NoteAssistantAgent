import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, isLoading, router]);

  const handleGoogleLogin = async () => {
    try {
      const res = await fetch("/api/auth/google/login");
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      alert("Failed to initiate Google login. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-10 w-full max-w-md text-center">
        {/* Logo */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Interview <span className="text-blue-600">Note</span>
          </h1>
          <p className="text-gray-500 mt-2 text-sm">AI-powered Interview Intelligence System</p>
        </div>

        <div className="space-y-4 mb-8 text-left">
          <div className="flex items-start gap-3">
            <span className="text-2xl">📝</span>
            <div>
              <p className="font-medium text-gray-800">Track interviews</p>
              <p className="text-gray-500 text-sm">Upload notes, AI extracts structured data</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-2xl">🔍</span>
            <div>
              <p className="font-medium text-gray-800">Analyze performance</p>
              <p className="text-gray-500 text-sm">Understand weaknesses with AI-powered insights</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-2xl">🎯</span>
            <div>
              <p className="font-medium text-gray-800">Practice mock interviews</p>
              <p className="text-gray-500 text-sm">Personalized questions based on your CV</p>
            </div>
          </div>
        </div>

        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 rounded-lg px-6 py-3 text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm"
        >
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.7 33.9 29.9 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z" />
            <path fill="#34A853" d="M6.3 14.7l7 5.1C15.2 16.5 19.3 14 24 14c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 16.3 2 9.6 7.4 6.3 14.7z" />
            <path fill="#FBBC05" d="M24 46c5.5 0 10.5-1.9 14.3-5.1l-6.6-5.4C29.7 37.3 27 38 24 38c-5.8 0-10.6-3.9-12.3-9.2l-7 5.4C8.2 42 15.5 46 24 46z" />
            <path fill="#EA4335" d="M44.5 20H24v8.5h11.8c-.8 2.3-2.3 4.3-4.3 5.7l6.6 5.4C42 36.1 46 30.5 46 24c0-1.3-.2-2.7-.5-4z" />
          </svg>
          Continue with Google
        </button>

        <p className="text-xs text-gray-400 mt-6">
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
