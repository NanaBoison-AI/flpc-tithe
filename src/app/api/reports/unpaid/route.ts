import { NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/auth/server";
import { unpaidMembers } from "@/lib/records/unpaid";
export const runtime = "nodejs";
export const maxDuration = 60;

export const GET = route(["admin", "recorder"], async (req) => {
  const { month } = z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) }).parse(Object.fromEntries(new URL(req.url).searchParams));
  return NextResponse.json({ month, ...(await unpaidMembers(month)) });
});
