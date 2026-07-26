"use client";

/**
 * Local session management — replaces Supabase Auth.
 *
 * The token is issued by the FastAPI backend (`/auth/signin`) and kept in two
 * places, deliberately:
 *
 *   · localStorage — read by client components and attached to API calls
 *   · a cookie      — read by middleware.ts, which runs on the server and
 *                     cannot see localStorage
 *
 * The cookie is not HttpOnly because the client needs the token too. That is
 * acceptable for a local single-user backend; a hosted deployment should move to
 * an HttpOnly cookie plus a server-side session, which is what Supabase Auth
 * provided.
 */

const STORAGE_KEY = "sondanote.session";
export const SESSION_COOKIE = "sondanote_token";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8002").replace(/\/$/, "");

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  industry: string;
  role?: string;
}

export interface Session {
  access_token: string;
  expires_at: number;
  user: { id: string; email: string };
  workspace: Workspace;
}

export class AuthError extends Error {}

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as Session;
    // Treat an expired token as absent so the UI redirects to login rather than
    // firing requests that will 401.
    if (session.expires_at && session.expires_at * 1000 < Date.now()) {
      clearSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function setSession(session: Session): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));

  // Mirror to a cookie for middleware. max-age tracks the token so the two
  // cannot disagree about whether a session is live.
  const maxAge = Math.max(0, session.expires_at - Math.floor(Date.now() / 1000));
  document.cookie = `${SESSION_COOKIE}=${session.access_token}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function clearSession(): void {
  window.localStorage.removeItem(STORAGE_KEY);
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

async function authRequest(path: string, email: string, password: string): Promise<Session> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new AuthError(
      `Cannot reach the Sonda Note API at ${API_BASE}. Is the backend running?`
    );
  }

  if (!response.ok) {
    let detail = "Authentication failed";
    try {
      const body = await response.json();
      if (body?.detail) {
        // FastAPI validation errors arrive as an array of objects.
        detail = Array.isArray(body.detail)
          ? body.detail.map((d: { msg?: string }) => d.msg ?? "Invalid input").join(", ")
          : String(body.detail);
      }
    } catch {
      /* keep the generic message */
    }
    throw new AuthError(detail);
  }

  const session = (await response.json()) as Session;
  setSession(session);
  return session;
}

export function signIn(email: string, password: string): Promise<Session> {
  return authRequest("/auth/signin", email, password);
}

export function signUp(email: string, password: string): Promise<Session> {
  return authRequest("/auth/signup", email, password);
}

export function signOut(): void {
  clearSession();
  window.location.href = "/login";
}

/** Auth headers for an API call. Throws if there is no live session. */
export function authHeaders(): HeadersInit {
  const session = getSession();
  if (!session) throw new AuthError("Your session expired — sign in again");
  return {
    Authorization: `Bearer ${session.access_token}`,
    "X-Workspace-Id": session.workspace.id,
    "Content-Type": "application/json",
  };
}

export function apiBase(): string {
  return API_BASE;
}
