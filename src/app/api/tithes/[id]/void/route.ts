import { NextResponse } from "next/server";
import { route } from "@/lib/auth/server";
import { audit } from "@/lib/audit";
import { titheVoid } from "@/lib/tithes/schema";
import { voidTithe } from "@/lib/tithes/service";
import { invalidateDashboard } from "@/lib/dashboard.server";
export const runtime = "nodejs";

export const POST = route<{ params: Promise<{ id: string }> }>(["admin"], async (req, staff, ctx) => {
  const { id } = await ctx.params;
  const { reason } = titheVoid.parse(await req.json());
  await voidTithe(staff, id, reason);
  invalidateDashboard();
  await audit(staff, "void", `tithes/${id}`, { reason });
  return NextResponse.json({ ok: true });
});
