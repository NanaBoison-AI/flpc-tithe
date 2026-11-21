import { NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/auth/server";
import { findDuplicates } from "@/lib/tithes/service";
import { tithePayload } from "@/lib/tithes/schema";
export const runtime = "nodejs";

const body = z.object({ checks: z.array(tithePayload.pick({ memberId: true, paymentDate: true, amount: true })).min(1).max(100) });
export const POST = route(["admin", "recorder"], async (req) => {
  const { checks } = body.parse(await req.json());
  return NextResponse.json({ duplicates: await findDuplicates(checks) });
});
