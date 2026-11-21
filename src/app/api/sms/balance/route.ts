import { NextResponse } from "next/server";
import { route, limitOrThrow } from "@/lib/auth/server";
import { getSmsProvider } from "@/lib/sms";
export const runtime = "nodejs";

export const GET = route(["admin"], async (_req, staff) => {
  limitOrThrow(staff, "sms-balance", 20, 60_000);
  const threshold = Number(process.env.SMS_LOW_BALANCE_THRESHOLD ?? 50);
  try {
    const b = await getSmsProvider().balance();
    return NextResponse.json({ available: true, balance: b.balance, bonus: b.bonus ?? 0, threshold, low: b.balance < threshold });
  } catch { return NextResponse.json({ available: false, threshold }); }
});
