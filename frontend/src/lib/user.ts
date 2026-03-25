/**
 * Legacy shim — delegates to auth.ts JWT-based user identity.
 * Kept for backward compatibility with existing page components.
 */
export { getUserId } from "@/lib/auth";

export function setUserId(_id: string) {
  // No-op: user identity is now managed by JWT in AuthContext.
}
