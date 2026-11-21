import { NextResponse } from "next/server";
import { z } from "zod";
import { route, limitOrThrow } from "@/lib/auth/server";
import { audit } from "@/lib/audit";
import { titheBatch } from "@/lib/tithes/schema";
import { createTithes, listByDate } from "@/lib/tithes/service";
export const runtime = "nodejs";

export const POST = route(["admin", "recorder"], async (req, staff) => {
  limitOrThrow(staff, "tithe-create", 60, 60_000);
  const { entries } = titheBatch.parse(await req.json());
  const results = await createTithes(staff, entries);
  const saved = results.filter((r) => r.ok && !r.duplicateOfExisting);
  if (saved.length) await audit(staff, "create", "tithes", { ids: saved.map((r) => r.id) });
  return NextResponse.json({ results });
});

export const GET = route(["admin", "recorder"], async (req) => {
  const { date } = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(Object.fromEntries(new URL(req.url).searchParams));
  return NextResponse.json(await listByDate(date));
});
