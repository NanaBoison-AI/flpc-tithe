import { NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/auth/server";
import { audit } from "@/lib/audit";
import { memberCreate } from "@/lib/members/schema";
import { createMember, searchMembers, invalidateMemberCache } from "@/lib/members/service";
export const runtime = "nodejs";

const query = z.object({ q: z.string().max(80).default(""), status: z.enum(["active", "inactive", "all"]).default("active"), limit: z.coerce.number().int().min(1).max(100).default(20) });

export const GET = route(["admin", "recorder"], async (req) => {
  const p = query.parse(Object.fromEntries(new URL(req.url).searchParams));
  return NextResponse.json({ members: await searchMembers(p.q, p.status, p.limit) });
});

export const POST = route(["admin"], async (req, staff) => {
  const input = memberCreate.parse(await req.json());
  const m = await createMember(input);
  invalidateMemberCache();
  await audit(staff, "member_change", `members/${m.id}`, { op: "create" });
  return NextResponse.json({ member: m }, { status: 201 });
});
