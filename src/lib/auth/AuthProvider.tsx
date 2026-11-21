"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

export type Role = "admin" | "recorder";
interface Ctx { user: User | null; role: Role | null; loading: boolean; logout: () => Promise<void> }
const AuthCtx = createContext<Ctx>({ user: null, role: null, loading: true, logout: async () => {} });
export const useAuth = () => useContext(AuthCtx);

const IDLE_MS = Number(process.env.NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES ?? 30) * 60_000;
const EVENTS = ["mousedown", "keydown", "touchstart", "scroll", "visibilitychange"] as const;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const last = useRef(Date.now());

  useEffect(() => onAuthStateChanged(auth, async (u) => {
    setUser(u);
    if (u) {
      const t = await u.getIdTokenResult(true);
      const r = t.claims.role;
      setRole(r === "admin" || r === "recorder" ? r : null);
    } else setRole(null);
    setLoading(false);
  }), []);

  const logout = useCallback(async () => { await signOut(auth); }, []);

  // Auto sign-out after inactivity. Uses wall-clock so it also fires after a sleeping phone wakes.
  useEffect(() => {
    if (!user) return;
    last.current = Date.now();
    const bump = () => { last.current = Date.now(); };
    EVENTS.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const timer = setInterval(() => { if (Date.now() - last.current >= IDLE_MS) signOut(auth); }, 15_000);
    return () => { EVENTS.forEach((e) => window.removeEventListener(e, bump)); clearInterval(timer); };
  }, [user]);

  return <AuthCtx.Provider value={{ user, role, loading, logout }}>{children}</AuthCtx.Provider>;
}

/** fetch wrapper that attaches the Firebase ID token. */
export async function apiFetch(path: string, init: RequestInit = {}) {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(path, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}`, ...(init.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}) }, cache: "no-store" });
  return res;
}
