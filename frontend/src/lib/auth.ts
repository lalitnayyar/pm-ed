// Token-based auth backed by the FastAPI /api/auth/* endpoints.

const AUTH_TOKEN_KEY = "pm-auth-token";
const AUTH_USER_KEY = "pm-auth-user";

export type AuthUser = {
  id: number;
  username: string;
  email: string | null;
  created_at: string;
};

// ── Token storage ─────────────────────────────────────────────────────────────

export const getStoredToken = (): string | null =>
  window.localStorage.getItem(AUTH_TOKEN_KEY);

export const getStoredUser = (): AuthUser | null => {
  const raw = window.localStorage.getItem(AUTH_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
};

export const setStoredAuth = (token: string, user: AuthUser): void => {
  window.localStorage.setItem(AUTH_TOKEN_KEY, token);
  window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
};

export const clearStoredAuth = (): void => {
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  window.localStorage.removeItem(AUTH_USER_KEY);
};

// ── API calls ─────────────────────────────────────────────────────────────────

type AuthPayload = { token: string; user: AuthUser };

export const apiRegister = async (
  username: string,
  password: string,
  email?: string
): Promise<AuthPayload> => {
  const resp = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, email: email || undefined }),
  });
  if (!resp.ok) {
    const err = (await resp.json().catch(() => ({}))) as { detail?: string };
    throw new Error(err.detail ?? "Registration failed");
  }
  return resp.json() as Promise<AuthPayload>;
};

export const apiLogin = async (
  username: string,
  password: string
): Promise<AuthPayload> => {
  const resp = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!resp.ok) {
    const err = (await resp.json().catch(() => ({}))) as { detail?: string };
    throw new Error(err.detail ?? "Login failed");
  }
  return resp.json() as Promise<AuthPayload>;
};

export const apiLogout = async (token: string): Promise<void> => {
  await fetch("/api/auth/logout", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
};

// ── Convenience helpers ───────────────────────────────────────────────────────

/** Return auth header object for use in fetch calls. */
export const authHeader = (token: string): Record<string, string> => ({
  Authorization: `Bearer ${token}`,
});
