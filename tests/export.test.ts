import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { buildPeriodReport, buildMemberReport, buildUnpaidReport } from "@/lib/export/builders";
import { toCsv } from "@/lib/export/csv";
import { toXlsx } from "@/lib/export/xlsx";
import { toPdf, pdfSafe } from "@/lib/export/pdf";
import { recordFilters, rowMatches, type TitheRow } from "@/lib/records/filters";

const row = (o: Partial<TitheRow>): TitheRow => ({ id: "x", paymentDate: "2026-03-01", memberId: "m1", memberName: "Ama Mensah", phone: "233241234567", amount: 10000, currency: "GHS", method: "cash", status: "active", smsStatus: "sent", recordedBy: "rec@c.org", ...o });
const data = [row({}), row({ id: "2", paymentDate: "2026-03-08", amount: 5050, method: "mobile_money", reference: "MM1" }), row({ id: "3", memberId: "m2", memberName: "=HYPERLINK(\"x\")", amount: 20000 }), row({ id: "4", amount: 99999, status: "voided" })];
async function* src() { for (const r of data) yield r; }
const common = { churchName: "FLPC", currency: "GHS", generatedOn: "2026-04-01" };
const nums = new Map([["m1", "A1"]]);
const read = async (s: ReadableStream<Uint8Array>) => Buffer.concat(await (async () => { const out: Buffer[] = []; const r = s.getReader(); for (;;) { const { value, done } = await r.read(); if (done) return out; out.push(Buffer.from(value)); } })());

describe("period export", () => {
  it("CSV: columns, decimal amounts, excludes voided from totals, neutralises formulas, has summary", async () => {
    const csv = (await read(toCsv(buildPeriodReport(src(), nums, { ...common, includeVoided: false, from: "2026-03-01", to: "2026-03-31" })))).toString("utf8");
    expect(csv).toContain("Date,Member name,Member no.,Phone,Amount,Method,Reference,Recorded by");
    expect(csv).toContain("2026-03-08,Ama Mensah,A1,233241234567,50.50,Mobile money,MM1,rec@c.org");
    expect(csv).toContain("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csv).toContain("Number of payers,2"); expect(csv).toContain("Total amount,GHS 350.50");
    expect(csv).toContain("Per-member subtotals");
  });
  it("marks voided rows when included but never counts them", async () => {
    const csv = (await read(toCsv(buildPeriodReport(src(), nums, { ...common, includeVoided: true, from: "2026-03-01", to: "2026-03-31" })))).toString("utf8");
    expect(csv).toContain("VOIDED"); expect(csv).toContain("Total amount,GHS 350.50"); expect(csv).toContain("Voided entries (not counted),1");
  });
  it("XLSX: valid workbook with Payments, Summary and per-member sheets", async () => {
    const buf = await read(toXlsx(buildPeriodReport(src(), nums, { ...common, includeVoided: false, from: "2026-03-01", to: "2026-03-31" })));
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf as any);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Payments", "Summary", "Per-member subtotals"]);
    const ws = wb.getWorksheet("Payments")!; expect(ws.rowCount).toBe(4); expect(ws.getRow(3).getCell(5).value).toBe(50.5);
    expect(wb.getWorksheet("Per-member subtotals")!.getRow(2).getCell(4).value).toBe(200);
  });
  it("PDF: produces a PDF", async () => {
    const buf = await read(toPdf(buildPeriodReport(src(), nums, { ...common, includeVoided: false, from: "2026-03-01", to: "2026-03-31" })));
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-"); expect(buf.length).toBeGreaterThan(1500);
    expect((buf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length).toBe(1); // a handful of rows must fit on ONE page
  });
  it("PDF handles many rows (pagination) and non-Latin names", async () => {
    async function* many() { for (let i = 0; i < 400; i++) yield row({ id: String(i), memberName: "Kwɛku Ɔdɔm", amount: 100 + i }); }
    const buf = await read(toPdf(buildPeriodReport(many(), nums, { ...common, includeVoided: false, from: "2026-01-01", to: "2026-12-31" })));
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-"); const pages = (buf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length;
    expect(pages).toBeGreaterThan(5); expect(pages).toBeLessThan(20); // 400 rows ≈ 12 landscape pages
    expect(pdfSafe("Kwɛku Ɔdɔm")).toBe("Kweku Odom");
  });
});
describe("member statement", () => {
  it("CSV/PDF/XLSX show member, period and total", async () => {
    const mk = () => buildMemberReport(src(), { fullName: "Ama Mensah", phone: "233241234567", memberNumber: "A1" }, { ...common, includeVoided: false, from: "2026-03-01", to: "2026-03-31" });
    const only = async function* () { yield data[0]; yield data[1]; };
    const rep = () => buildMemberReport(only(), { fullName: "Ama Mensah", phone: "233241234567", memberNumber: "A1" }, { ...common, includeVoided: false, from: "2026-03-01", to: "2026-03-31" });
    const csv = (await read(toCsv(rep()))).toString("utf8");
    expect(csv).toContain("Total for period,GHS 150.50"); expect(mk().filename).toBe("statement_ama-mensah_2026-03-01_to_2026-03-31");
    const pdf = await read(toPdf(rep()));
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-"); expect((pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length).toBe(1);
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load((await read(toXlsx(rep()))) as any); expect(wb.getWorksheet("Summary")).toBeTruthy();
  });
});
describe("unpaid report + filters", () => {
  it("lists members", async () => {
    const csv = (await read(toCsv(buildUnpaidReport([{ fullName: "Kofi", phone: "233201111111" }], "2026-03", { ...common, includeVoided: false })))).toString("utf8");
    expect(csv).toContain("Kofi,,233201111111"); expect(csv).toContain("Members not yet paid,1");
  });
  it("recordFilters validates range and defaults status", () => {
    expect(recordFilters.parse({ from: "2026-01-01", to: "2026-01-31" }).status).toBe("active");
    expect(recordFilters.safeParse({ from: "2026-02-01", to: "2026-01-31" }).success).toBe(false);
    expect(recordFilters.safeParse({ from: "2020-01-01", to: "2026-01-31" }).success).toBe(false);
  });
  it("rowMatches", () => {
    const f = recordFilters.parse({ from: "2026-01-01", to: "2026-01-31", method: "cash", smsStatus: "sent" });
    expect(rowMatches(row({}), f)).toBe(true); expect(rowMatches(row({ method: "bank" }), f)).toBe(false); expect(rowMatches(row({ status: "voided" }), f)).toBe(false);
  });
});
