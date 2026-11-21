import { NextResponse } from "next/server";
import { route, limitOrThrow } from "@/lib/auth/server";
import { audit } from "@/lib/audit";
import { sendAckForTithe } from "@/lib/sms/send";
export const runtime = "nodejs";
export const maxDuration = 30;

export const POST = route<{ params: Promise<{ id: string }> }>(["admin", "recorder"], async (_req, staff, ctx) => {
  limitOrThrow(staff, "sms", 30, 60_000);
  const { id } = await ctx.params;
  const out = await sendAckForTithe(id);
  await audit(staff, "sms_retry", `tithes/${id}`, { status: out.status });
  return NextResponse.json(out);
});
