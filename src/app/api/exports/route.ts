import { z } from "zod";
import { route, limitOrThrow, HttpError } from "@/lib/auth/server";
import { audit } from "@/lib/audit";
import { getSettings } from "@/lib/settings";
import { recordFilters } from "@/lib/records/filters";
import { iterateTithes } from "@/lib/records/source";
import { memberDirectory, getMember } from "@/lib/members/service";
import { buildPeriodReport, buildMemberReport, buildUnpaidReport } from "@/lib/export/builders";
import { toCsv } from "@/lib/export/csv";
import { toXlsx } from "@/lib/export/xlsx";
import { toPdf } from "@/lib/export/pdf";
import { FORMATS } from "@/lib/export/types";
import { dateInTz } from "@/lib/time";
import { unpaidMembers } from "@/lib/records/unpaid";
export const runtime = "nodejs";
export const maxDuration = 60;

const q = z.object({
  type: z.enum(["period", "member", "unpaid"]),
  format: z.enum(["csv", "xlsx", "pdf"]),
  from: z.string().optional(), to: z.string().optional(), month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  memberId: z.string().max(64).optional(), includeVoided: z.enum(["true", "false"]).default("false"),
});

export const GET = route(["admin", "recorder"], async (req, staff) => {
  limitOrThrow(staff, "export", 15, 60_000);
  const p = q.parse(Object.fromEntries(new URL(req.url).searchParams));
  const s = await getSettings();
  const includeVoided = p.includeVoided === "true";
  const common = { churchName: s.churchName, currency: s.defaultCurrency, includeVoided, generatedOn: dateInTz(new Date(), s.timezone) };

  let report;
  if (p.type === "unpaid") {
    if (!p.month) throw new HttpError(400, "month is required");
    const { members } = await unpaidMembers(p.month);
    report = buildUnpaidReport(members, p.month, common);
  } else {
    const f = recordFilters.parse({ from: p.from, to: p.to, memberId: p.type === "member" ? p.memberId : undefined, status: includeVoided ? "all" : "active" });
    if (p.type === "member") {
      if (!p.memberId) throw new HttpError(400, "memberId is required");
      const m = await getMember(p.memberId);
      if (!m) throw new HttpError(404, "Member not found");
      report = buildMemberReport(iterateTithes(f), m, { ...common, from: f.from, to: f.to });
    } else {
      const dir = await memberDirectory();
      const numbers = new Map(dir.flatMap((m) => (m.memberNumber ? [[m.id, m.memberNumber] as [string, string]] : [])));
      report = buildPeriodReport(iterateTithes(f), numbers, { ...common, from: f.from, to: f.to });
    }
  }
  await audit(staff, "export", p.type, { format: p.format, from: p.from, to: p.to, month: p.month, memberId: p.memberId, includeVoided });
  const body = p.format === "csv" ? toCsv(report) : p.format === "xlsx" ? toXlsx(report) : toPdf(report);
  return new Response(body, {
    headers: {
      "Content-Type": FORMATS[p.format],
      "Content-Disposition": `attachment; filename="${report.filename}.${p.format}"`,
      "X-Content-Type-Options": "nosniff", "Pragma": "no-cache",
    },
  });
});
