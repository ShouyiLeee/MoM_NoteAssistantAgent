const DEFAULT_USER = "user-123";

export function getUserId(): string {
  if (typeof window === "undefined") return DEFAULT_USER;
  return localStorage.getItem("user_id") || DEFAULT_USER;
}

export function setUserId(id: string) {
  localStorage.setItem("user_id", id);
}
