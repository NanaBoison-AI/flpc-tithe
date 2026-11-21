import { NextResponse } from "next/server";
import { route } from "@/lib/auth/server";
import { getSettings } from "@/lib/settings";
export const runtime = "nodejs";

// Non-sensitive subset for the client (never the sender ID or templates).
export const GET = route(["admin", "recorder"], async () => {
  const s = await getSettings();
  return NextResponse.json({ churchName: s.churchName, defaultCurrency: s.defaultCurrency, timezone: s.timezone });
});
