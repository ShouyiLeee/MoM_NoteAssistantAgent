import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Redirect to /login if not authenticated.
 * Redirect to /role-select if authenticated but has no roles yet.
 */
export function useRequireAuth() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (user && (!user.roles || user.roles.length === 0)) {
      router.replace("/role-select");
    }
  }, [isAuthenticated, isLoading, user, router]);

  return { isLoading, isAuthenticated };
}

/**
 * Redirect to /login if not authenticated.
 * Redirect to /unauthorized if authenticated but missing required role.
 */
export function useRequireRole(role: "interviewee" | "interviewer") {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (user && !user.roles?.includes(role)) {
      router.replace("/");
    }
  }, [isAuthenticated, isLoading, user, role, router]);
}
