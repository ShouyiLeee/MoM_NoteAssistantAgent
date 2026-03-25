import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/contexts/AuthContext";

/**
 * OAuth callback page.
 * The backend redirects here after Google login: /auth/callback?token=...
 * We capture the token, store it, and redirect appropriately.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const { login, user, isLoading } = useAuth();

  useEffect(() => {
    if (!router.isReady) return;
    const { token, error } = router.query;

    if (error) {
      router.replace(`/login?error=${error}`);
      return;
    }

    if (!token || typeof token !== "string") return;

    login(token);
    // After login(), AuthContext fetches /auth/me and sets user.
    // We wait for isLoading to finish, then redirect.
  }, [router.isReady, router.query, login, router]);

  // Once user is loaded, redirect based on role state
  useEffect(() => {
    if (isLoading) return;
    if (!user) return;

    if (!user.roles || user.roles.length === 0) {
      router.replace("/role-select");
    } else {
      router.replace("/");
    }
  }, [user, isLoading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-600">Signing you in...</p>
      </div>
    </div>
  );
}
