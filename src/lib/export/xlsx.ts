import { PassThrough, Readable } from "stream";
import ExcelJS from "exceljs";
import type { Report, Col } from "./types";

const fmt = (c: Col) => (c.type === "money" ? "#,##0.00" : undefined);
const val = (c: Col, v: unknown) => (v === undefined || v === null ? "" : c.type === "money" ? Number(v) / 100 : c.type === "date" ? String(v) : typeof v === "string" && /^[=+\-@]/.test(v) ? `'${v}` : v);

/** Streams the workbook so large exports don't hold everything in memory. */
export function toXlsx(rep: Report): ReadableStream<Uint8Array> {
  const pass = new PassThrough();
  const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: pass, useStyles: true, useSharedStrings: false });
  (async () => {
    const ws = wb.addWorksheet("Payments", { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = rep.columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 16, style: fmt(c) ? { numFmt: fmt(c) } : {} }));
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).commit();
    for await (const r of rep.rows) {
      const row = ws.addRow(Object.fromEntries(rep.columns.map((c) => [c.key, val(c, r[c.key])])));
      if (r._voided) row.font = { color: { argb: "FF888888" }, strike: true };
      row.commit();
    }
    ws.commit();
    const a = rep.after?.();
    if (a) {
      const s = wb.addWorksheet("Summary");
      s.columns = [{ width: 30 }, { width: 30 }];
      s.addRow([rep.title]).font = { bold: true, size: 14 };
      for (const [k, v] of rep.meta ?? []) s.addRow([k, v]);
      s.addRow([]);
      for (const [k, v] of a.summary) s.addRow([k, v]).getCell(1).font = { bold: true };
      s.commit();
      for (const [i, t] of (a.tables ?? []).entries()) {
        const w = wb.addWorksheet((t.title || `Table ${i + 1}`).slice(0, 31));
        w.columns = t.columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 18, style: fmt(c) ? { numFmt: fmt(c) } : {} }));
        w.getRow(1).font = { bold: true }; w.getRow(1).commit();
        for (const r of t.rows) w.addRow(Object.fromEntries(t.columns.map((c) => [c.key, val(c, r[c.key])]))).commit();
        w.commit();
      }
    }
    await wb.commit();
  })().catch((e) => pass.destroy(e));
  return Readable.toWeb(pass) as unknown as ReadableStream<Uint8Array>;
}
