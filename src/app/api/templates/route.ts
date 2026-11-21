import { NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { audit } from "@/lib/audit";
import { getSettings, invalidateSettings } from "@/lib/settings";
import { findUnknownPlaceholders } from "@/lib/sms/template";
export const runtime = "nodejs";

const body = z.string().trim().min(1, "Message cannot be empty").max(640, "Message is too long")
  .superRefine((v, ctx) => { const bad = findUnknownPlaceholders(v); if (bad.length) ctx.addIssue({ code: "custom", message: `Unknown placeholder(s): ${bad.map((b) => `{${b}}`).join(", ")}` }); });
const put = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("month"), month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), body }),
  z.object({ kind: z.literal("default"), body }),
]);

export const GET = route(["admin"], async () => {
  const [snap, s] = await Promise.all([adminDb().collection("smsTemplates").orderBy("updatedAt", "desc").limit(60).get(), getSettings()]);
  return NextResponse.json({
    defaultTemplate: s.defaultTemplate, churchName: s.churchName, currency: s.defaultCurrency,
    templates: snap.docs.map((d) => ({ month: d.id, body: d.data().body, updatedBy: d.data().updatedBy, updatedAt: d.data().updatedAt?.toDate?.().toISOString() })),
  });
});

export const PUT = route(["admin"], async (req, staff) => {
  const p = put.parse(await req.json());
  if (p.kind === "month") {
    await adminDb().collection("smsTemplates").doc(p.month).set({ body: p.body, updatedBy: staff.email, updatedAt: new Date() });
    await audit(staff, "template_change", `smsTemplates/${p.month}`, {});
  } else {
    await adminDb().collection("settings").doc("app").set({ defaultTemplate: p.body }, { merge: true });
    invalidateSettings();
    await audit(staff, "template_change", "settings/app", { field: "defaultTemplate" });
  }
  return NextResponse.json({ ok: true });
});
