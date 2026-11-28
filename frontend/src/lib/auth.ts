import { supabase } from "./supabase";

const TOKEN_KEY = "rkmsp_auth_token";
const USER_KEY = "rkmsp_auth_user";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  is_admin: boolean;
  designation?: string;
  reg_no?: string;
}

export function getStoredAuth(): { token: string; user: AuthUser } | null {
  if (typeof window === "undefined") return null;
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const rawUser = localStorage.getItem(USER_KEY);
    if (!token || !rawUser) return null;

    // Decode JWT payload to check expiration
    const payloadPart = token.split(".")[1];
    if (payloadPart) {
      const payload = JSON.parse(atob(payloadPart.replace(/-/g, "+").replace(/_/g, "/")));
      if (payload.exp && Date.now() >= payload.exp * 1000) {
        clearAuth();
        return null;
      }
    }
    return { token, user: JSON.parse(rawUser) as AuthUser };
  } catch {
    return null;
  }
}

export function clearAuth() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function loginWithMongo(email: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Invalid email or password.");
  }

  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  return data.user as AuthUser;
}

export async function logoutAuth() {
  clearAuth();
  try {
    await supabase.auth.signOut();
  } catch {
    // ignore
  }
}
