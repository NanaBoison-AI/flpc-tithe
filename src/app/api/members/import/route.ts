import { NextResponse } from "next/server";
import { z } from "zod";
import { route, HttpError } from "@/lib/auth/server";
import { audit } from "@/lib/audit";
import { parseMemberCsv } from "@/lib/members/import";
import { existingKeys, bulkCreate } from "@/lib/members/service";
export const runtime = "nodejs";

const body = z.object({ csv: z.string().max(1_000_000), commit: z.boolean().default(false) });

// commit=false => preview only; commit=true => import every valid row, skip the invalid ones.
export const POST = route(["admin"], async (req, staff) => {
  const { csv, commit } = body.parse(await req.json());
  const { phones, numbers } = await existingKeys();
  const { rows, fatal } = parseMemberCsv(csv, phones, numbers);
  if (fatal) throw new HttpError(400, fatal);
  const valid = rows.filter((r) => !r.errors.length);
  const invalid = rows.filter((r) => r.errors.length);
  if (commit) {
    await bulkCreate(valid.map((r) => ({ fullName: r.fullName, phone: r.phone!, memberNumber: r.memberNumber })));
    await audit(staff, "member_change", "members", { op: "import", imported: valid.length, skipped: invalid.length });
  }
  return NextResponse.json({ committed: commit, total: rows.length, validCount: valid.length, invalidCount: invalid.length, preview: rows.slice(0, 200), errors: invalid });
});
