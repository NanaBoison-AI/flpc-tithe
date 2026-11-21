import { NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { getSettings } from "@/lib/settings";
import { dayStartUtc, dayEndUtc } from "@/lib/time";
export const runtime = "nodejs";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();
const q = z.object({
  from: date, to: date, limit: z.coerce.number().int().min(1).max(200).default(100),
  action: z.enum(["create", "edit", "void", "template_change", "export", "settings_change", "member_change", "sms_retry"]).optional(),
});

export const GET = route(["admin"], async (req) => {
  const p = q.parse(Object.fromEntries([...new URL(req.url).searchParams].filter(([, v]) => v)));
  const tz = (await getSettings()).timezone;
  let query: FirebaseFirestore.Query = adminDb().collection("auditLogs");
  if (p.action) query = query.where("action", "==", p.action);
  if (p.from) query = query.where("at", ">=", dayStartUtc(p.from, tz));
  if (p.to) query = query.where("at", "<", dayEndUtc(p.to, tz));
  const snap = await query.orderBy("at", "desc").limit(p.limit).get();
  return NextResponse.json({ entries: snap.docs.map((d) => { const x = d.data(); return { id: d.id, action: x.action, target: x.target, details: x.details ?? {}, by: x.by?.email ?? "", at: x.at?.toDate?.().toISOString() }; }) });
});
