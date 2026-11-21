import { NextResponse } from "next/server";
import { route } from "@/lib/auth/server";
import { audit } from "@/lib/audit";
import { memberUpdate } from "@/lib/members/schema";
import { updateMember, invalidateMemberCache } from "@/lib/members/service";
export const runtime = "nodejs";

export const PATCH = route<{ params: Promise<{ id: string }> }>(["admin"], async (req, staff, ctx) => {
  const { id } = await ctx.params;
  const patch = memberUpdate.parse(await req.json());
  const m = await updateMember(id, patch);
  invalidateMemberCache();
  await audit(staff, "member_change", `members/${id}`, { op: "update", fields: Object.keys(patch) });
  return NextResponse.json({ member: m });
});
