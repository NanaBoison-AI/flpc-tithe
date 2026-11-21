import { NextResponse } from "next/server";
import { route } from "@/lib/auth/server";
import { recordFilters } from "@/lib/records/filters";
import { iterateTithes } from "@/lib/records/source";
export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_ROWS = 500;

// Totals cover EVERY matching record; the returned rows are capped to keep responses small.
export const GET = route(["admin", "recorder"], async (req) => {
  const f = recordFilters.parse(Object.fromEntries([...new URL(req.url).searchParams].filter(([, v]) => v)));
  const rows = []; let count = 0, sum = 0, voided = 0, total = 0;
  for await (const r of iterateTithes(f)) {
    total++;
    if (r.status === "active") { count++; sum += r.amount; } else voided++;
    if (rows.length < MAX_ROWS) rows.push(r);
  }
  rows.reverse(); // newest dates first
  return NextResponse.json({ rows, count, sum, voided, truncated: total > MAX_ROWS, total });
});
