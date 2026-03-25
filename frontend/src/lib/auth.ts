const TOKEN_KEY = "auth_token";

export interface JwtPayload {
  sub: string;       // user UUID
  email: string;
  roles: string[];
  exp: number;
}

export function storeToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function decodeToken(token: string): JwtPayload | null {
  try {
    const base64 = token.split(".")[1];
    const json = atob(base64.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const payload = decodeToken(token);
  if (!payload) return true;
  return payload.exp * 1000 < Date.now();
}

/** Backward-compat: return user UUID from JWT, or fallback for unauthenticated. */
export function getUserId(): string {
  const token = getToken();
  if (token) {
    const payload = decodeToken(token);
    if (payload?.sub) return payload.sub;
  }
  return "anonymous";
}
