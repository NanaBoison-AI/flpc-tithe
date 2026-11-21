import { NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { audit } from "@/lib/audit";
import { getSettings, invalidateSettings } from "@/lib/settings";
export const runtime = "nodejs";

const validTz = (tz: string) => { try { new Intl.DateTimeFormat("en", { timeZone: tz }); return true; } catch { return false; } };
const put = z.object({
  churchName: z.string().trim().min(1).max(80),
  senderId: z.string().trim().max(11, "Sender ID can be at most 11 characters").regex(/^[A-Za-z0-9 ]*$/, "Letters and numbers only"),
  defaultCurrency: z.literal("GHS"),
  timezone: z.string().refine(validTz, "Unknown timezone"),
});

export const GET = route(["admin"], async () => {
  const s = await getSettings();
  return NextResponse.json({ churchName: s.churchName, senderId: s.senderId, defaultCurrency: s.defaultCurrency, timezone: s.timezone, envSenderId: Boolean(process.env.MNOTIFY_SENDER_ID) });
});
export const PUT = route(["admin"], async (req, staff) => {
  const p = put.parse(await req.json());
  await adminDb().collection("settings").doc("app").set(p, { merge: true });
  invalidateSettings();
  await audit(staff, "settings_change", "settings/app", { fields: Object.keys(p) });
  return NextResponse.json({ ok: true });
});
