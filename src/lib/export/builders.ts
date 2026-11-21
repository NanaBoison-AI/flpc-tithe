import { formatMoney } from "@/lib/money";
import { METHOD_LABEL } from "@/lib/tithes/schema";
import type { TitheRow } from "@/lib/records/filters";
import type { Report, Row, Col } from "./types";

const methodLabel = (m: string) => (METHOD_LABEL as Record<string, string>)[m] ?? m;
interface Common { churchName: string; currency: string; includeVoided: boolean; generatedOn: string }

async function* mapRows(src: AsyncIterable<TitheRow>, includeVoided: boolean, fn: (r: TitheRow) => Row): AsyncGenerator<Row> {
  for await (const r of src) { if (r.status === "voided" && !includeVoided) continue; yield fn(r); }
}

/** a) Everyone who paid in a period, with summary and per-member subtotals. Voided rows are shown but never counted. */
export function buildPeriodReport(src: AsyncIterable<TitheRow>, numbers: Map<string, string>, p: Common & { from: string; to: string }): Report {
  const per = new Map<string, { name: string; number: string; count: number; total: number }>();
  let total = 0, count = 0, voided = 0;
  const columns: Col[] = [
    { key: "date", header: "Date", type: "date", width: 12 }, { key: "name", header: "Member name", width: 26 }, { key: "number", header: "Member no.", width: 12 },
    { key: "phone", header: "Phone", width: 15 }, { key: "amount", header: "Amount", type: "money", width: 14 }, { key: "method", header: "Method", width: 14 },
    { key: "reference", header: "Reference", width: 16 }, { key: "by", header: "Recorded by", width: 24 },
    ...(p.includeVoided ? [{ key: "status", header: "Status", width: 10 } as Col] : []),
  ];
  const rows = mapRows(src, p.includeVoided, (r) => {
    const isVoid = r.status === "voided";
    if (isVoid) voided++;
    else {
      total += r.amount; count++;
      const e = per.get(r.memberId) ?? { name: r.memberName, number: numbers.get(r.memberId) ?? "", count: 0, total: 0 };
      e.count++; e.total += r.amount; per.set(r.memberId, e);
    }
    return { date: r.paymentDate, name: r.memberName, number: numbers.get(r.memberId) ?? "", phone: r.phone, amount: r.amount, method: methodLabel(r.method), reference: r.reference ?? "", by: r.recordedBy, status: isVoid ? "VOIDED" : "", _voided: isVoid };
  });
  return {
    filename: `tithes_${p.from}_to_${p.to}`, title: "Tithe Records", subtitle: `${p.from} to ${p.to}`,
    meta: [["Period", `${p.from} to ${p.to}`], ["Generated", p.generatedOn]], columns, rows, currency: p.currency, churchName: p.churchName,
    after: () => ({
      summary: [["Number of payers", String(per.size)], ["Number of payments", String(count)], ...(p.includeVoided ? [["Voided entries (not counted)", String(voided)] as [string, string]] : []), ["Total amount", formatMoney(total, p.currency)]],
      tables: [{ title: "Per-member subtotals", columns: [{ key: "name", header: "Member", width: 30 }, { key: "number", header: "Member no.", width: 14 }, { key: "count", header: "Payments", width: 10 }, { key: "total", header: "Subtotal", type: "money", width: 16 }],
        rows: [...per.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)) }],
    }),
  };
}

/** b) One member's statement for a period. */
export function buildMemberReport(src: AsyncIterable<TitheRow>, m: { fullName: string; phone: string; memberNumber?: string }, p: Common & { from: string; to: string }): Report {
  let total = 0, count = 0;
  const columns: Col[] = [
    { key: "date", header: "Date", type: "date", width: 14 }, { key: "method", header: "Method", width: 16 }, { key: "reference", header: "Reference", width: 22 },
    { key: "amount", header: "Amount", type: "money", width: 16 }, ...(p.includeVoided ? [{ key: "status", header: "Status", width: 10 } as Col] : []),
  ];
  const rows = mapRows(src, p.includeVoided, (r) => {
    const v = r.status === "voided"; if (!v) { total += r.amount; count++; }
    return { date: r.paymentDate, method: methodLabel(r.method), reference: r.reference ?? "", amount: r.amount, status: v ? "VOIDED" : "", _voided: v };
  });
  const slug = m.fullName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "member";
  return {
    filename: `statement_${slug}_${p.from}_to_${p.to}`, title: "Tithe Statement", subtitle: `${p.from} to ${p.to}`, statement: true,
    meta: [["Member", m.fullName], ...(m.memberNumber ? [["Member no.", m.memberNumber] as [string, string]] : []), ["Period", `${p.from} to ${p.to}`], ["Date issued", p.generatedOn]],
    columns, rows, currency: p.currency, churchName: p.churchName,
    after: () => ({ summary: [["Number of payments", String(count)], ["Total for period", formatMoney(total, p.currency)]] }),
  };
}

/** Active members with no active tithe in the month. */
export function buildUnpaidReport(members: { fullName: string; phone: string; memberNumber?: string }[], month: string, p: Common): Report {
  async function* gen(): AsyncGenerator<Row> { for (const m of members) yield { name: m.fullName, number: m.memberNumber ?? "", phone: m.phone }; }
  return {
    filename: `not-paid_${month}`, title: "Members who have not paid", subtitle: month, meta: [["Month", month], ["Generated", p.generatedOn]],
    columns: [{ key: "name", header: "Member name", width: 30 }, { key: "number", header: "Member no.", width: 14 }, { key: "phone", header: "Phone", width: 16 }],
    rows: gen(), currency: p.currency, churchName: p.churchName, after: () => ({ summary: [["Members not yet paid", String(members.length)]] }),
  };
}
