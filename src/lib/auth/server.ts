import "server-only";
import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { rateLimit } from "@/lib/ratelimit";

export type Role = "admin" | "recorder";
export interface Staff { uid: string; email: string; role: Role }

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

// Role lookups are cached briefly so every API call doesn't cost an extra Firestore read.
// A role change made in the console therefore takes effect within ~60 seconds.
const ROLE_TTL_MS = 60_000;
const roleCache = new Map<string, { role: Role | null; at: number }>();
export const _resetRoleCache = () => roleCache.clear();

async function roleFor(uid: string): Promise<Role | null> {
  const hit = roleCache.get(uid);
  if (hit && Date.now() - hit.at < ROLE_TTL_MS) return hit.role;
  const snap = await adminDb().collection("users").doc(uid).get();
  const r = snap.exists ? snap.data()?.role : undefined;
  const role: Role | null = r === "admin" || r === "recorder" ? r : null;
  if (role) roleCache.set(uid, { role, at: Date.now() }); // never cache "no role", so a newly added user works immediately
  return role;
}

/** Verify the Firebase ID token, then read the role from users/{uid}. Throws HttpError(401/403). */
export async function requireRole(req: Request, allowed: Role[] = ["admin", "recorder"]): Promise<Staff> {
  const h = req.headers.get("authorization") ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!token) throw new HttpError(401, "Missing token");
  let decoded;
  try { decoded = await adminAuth().verifyIdToken(token, true); }
  catch { throw new HttpError(401, "Invalid or expired token"); }
  const role = await roleFor(decoded.uid);
  if (!role) throw new HttpError(403, "No role assigned");
  if (!allowed.includes(role)) throw new HttpError(403, "Insufficient permissions");
  return { uid: decoded.uid, email: decoded.email ?? "", role };
}

export function limitOrThrow(staff: Staff, bucket: string, limit: number, windowMs: number) {
  const r = rateLimit(`${bucket}:${staff.uid}`, limit, windowMs);
  if (!r.ok) throw new HttpError(429, `Too many requests. Retry in ${r.retryAfterSec}s`);
}

/** Wrap a route handler with auth, role check and uniform error handling. No PII in logs. */
export function route<T = unknown>(allowed: Role[], handler: (req: Request, staff: Staff, ctx: T) => Promise<Response>) {
  return async (req: Request, ctx: T) => {
    try {
      const staff = await requireRole(req, allowed);
      const res = await handler(req, staff, ctx);
      res.headers.set("Cache-Control", "no-store");
      return res;
    } catch (e: any) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status, headers: { "Cache-Control": "no-store" } });
      if (e?.name === "ZodError") return NextResponse.json({ error: "Invalid input", issues: e.issues?.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      console.error("route error:", e?.code ?? e?.name ?? "unknown");
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
  };
}
