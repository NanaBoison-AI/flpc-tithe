import "server-only";
import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { rateLimit } from "@/lib/ratelimit";

export type Role = "admin" | "recorder";
export interface Staff { uid: string; email: string; role: Role }

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Verify the Firebase ID token and role claim. Throws HttpError(401/403). */
export async function requireRole(req: Request, allowed: Role[] = ["admin", "recorder"]): Promise<Staff> {
  const h = req.headers.get("authorization") ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!token) throw new HttpError(401, "Missing token");
  let decoded;
  try { decoded = await adminAuth().verifyIdToken(token, true); }
  catch { throw new HttpError(401, "Invalid or expired token"); }
  const role = decoded.role as Role | undefined;
  if (role !== "admin" && role !== "recorder") throw new HttpError(403, "No role assigned");
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
