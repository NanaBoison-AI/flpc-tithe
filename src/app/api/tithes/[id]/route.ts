import { NextResponse } from "next/server";
import { route } from "@/lib/auth/server";
import { audit } from "@/lib/audit";
import { titheEdit } from "@/lib/tithes/schema";
import { editTithe } from "@/lib/tithes/service";
import { invalidateDashboard } from "@/lib/dashboard.server";
export const runtime = "nodejs";

export const PATCH = route<{ params: Promise<{ id: string }> }>(["admin"], async (req, staff, ctx) => {
  const { id } = await ctx.params;
  const patch = titheEdit.parse(await req.json());
  const changes = await editTithe(staff, id, patch);
  invalidateDashboard();
  await audit(staff, "edit", `tithes/${id}`, { changes });
  return NextResponse.json({ ok: true });
});
