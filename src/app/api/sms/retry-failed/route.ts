import { NextResponse } from "next/server";
import { route, limitOrThrow } from "@/lib/auth/server";
import { audit } from "@/lib/audit";
import { retryAllFailed } from "@/lib/sms/send";
export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = route(["admin", "recorder"], async (_req, staff) => {
  limitOrThrow(staff, "sms-retry-all", 5, 60_000);
  const out = await retryAllFailed(100);
  await audit(staff, "sms_retry", "tithes", out);
  return NextResponse.json(out);
});
