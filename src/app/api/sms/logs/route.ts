import { NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { getSettings } from "@/lib/settings";
import { dayStartUtc, dayEndUtc } from "@/lib/time";
export const runtime = "nodejs";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();
const q = z.object({ from: date, to: date, status: z.enum(["sent", "failed"]).optional(), memberId: z.string().max(64).optional(), limit: z.coerce.number().int().min(1).max(200).default(100) });

export const GET = route(["admin"], async (req) => {
  const p = q.parse(Object.fromEntries([...new URL(req.url).searchParams].filter(([, v]) => v)));
  const tz = (await getSettings()).timezone;
  let query: FirebaseFirestore.Query = adminDb().collection("smsLogs");
  if (p.status) query = query.where("status", "==", p.status);
  if (p.memberId) query = query.where("memberId", "==", p.memberId);
  if (p.from) query = query.where("createdAt", ">=", dayStartUtc(p.from, tz));
  if (p.to) query = query.where("createdAt", "<", dayEndUtc(p.to, tz));
  const snap = await query.orderBy("createdAt", "desc").limit(p.limit).get();
  const logs = snap.docs.map((d) => { const x = d.data(); return { id: d.id, ...x, createdAt: x.createdAt?.toDate?.().toISOString(), sentAt: x.sentAt?.toDate?.().toISOString() ?? null, lastAttemptAt: x.lastAttemptAt?.toDate?.().toISOString() }; });
  return NextResponse.json({ logs });
});
