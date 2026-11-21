import { PassThrough, Readable } from "stream";
import PDFDocument from "pdfkit";
import { formatMoney } from "@/lib/money";
import type { Report, Col, Row } from "./types";

// pdfkit's built-in fonts only cover Latin-1; map common Ghanaian letters and drop what can't be drawn.
const MAP: Record<string, string> = { ɛ: "e", Ɛ: "E", ɔ: "o", Ɔ: "O", ŋ: "ng", Ŋ: "Ng", "’": "'", "‘": "'", "“": '"', "”": '"', "–": "-", "—": "-" };
export const pdfSafe = (s: unknown) => String(s ?? "").replace(/[^\u0000-ÿ]/g, (ch) => MAP[ch] ?? ch.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\u0000-ÿ]/g, "?"));

const INK = "#111827", MUTED = "#6b7280", LINE = "#d1d5db", HEAD = "#eef2ff";

export function toPdf(rep: Report): ReadableStream<Uint8Array> {
  const landscape = !rep.statement && rep.columns.length > 6;
  const doc = new PDFDocument({ size: "A4", layout: landscape ? "landscape" : "portrait", margin: 40, info: { Title: rep.title } });
  const pass = new PassThrough();
  doc.pipe(pass);
  let pageNo = 0;
  const footer = () => {
    pageNo++;
    const { x, y } = doc; // drawing the footer moves the cursor; restore it or content would flow onto endless new pages
    const b = doc.page.margins.bottom; doc.page.margins.bottom = 0;
    doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(`${pdfSafe(rep.churchName)}  ·  Confidential  ·  Page ${pageNo}`, 40, doc.page.height - 28, { width: doc.page.width - 80, align: "center", lineBreak: false });
    doc.page.margins.bottom = b;
    doc.x = x; doc.y = y;
  };
  doc.on("pageAdded", footer); footer();

  const W = () => doc.page.width - 80;
  const cellText = (c: Col, r: Row) => (c.type === "money" ? (r[c.key] === undefined ? "" : formatMoney(Number(r[c.key]), rep.currency)) : pdfSafe(r[c.key]));
  const widths = (cols: Col[]) => { const t = cols.reduce((n, c) => n + (c.width ?? 14), 0); return cols.map((c) => ((c.width ?? 14) / t) * W()); };

  function headerRow(cols: Col[]) {
    const ws = widths(cols); const y = doc.y;
    doc.rect(40, y, W(), 20).fill(HEAD);
    let x = 40; doc.fillColor(INK).font("Helvetica-Bold").fontSize(8.5);
    cols.forEach((c, i) => { doc.text(pdfSafe(c.header), x + 4, y + 6, { width: ws[i] - 8, align: c.type === "money" ? "right" : "left", lineBreak: false, ellipsis: true }); x += ws[i]; });
    doc.y = y + 22;
  }
  function dataRow(cols: Col[], r: Row) {
    const ws = widths(cols);
    if (doc.y > doc.page.height - 70) { doc.addPage(); headerRow(cols); }
    const y = doc.y; let x = 40;
    doc.font("Helvetica").fontSize(8.5).fillColor(r._voided ? MUTED : INK);
    cols.forEach((c, i) => { doc.text(cellText(c, r), x + 4, y + 3, { width: ws[i] - 8, align: c.type === "money" ? "right" : "left", lineBreak: false, ellipsis: true }); x += ws[i]; });
    doc.moveTo(40, y + 16).lineTo(40 + W(), y + 16).strokeColor(LINE).lineWidth(0.5).stroke();
    if (r._voided) doc.moveTo(40, y + 8).lineTo(40 + W(), y + 8).strokeColor(MUTED).stroke();
    doc.y = y + 18;
  }

  (async () => {
    // Heading
    doc.fillColor(MUTED).font("Helvetica").fontSize(9).text(pdfSafe(rep.churchName).toUpperCase(), { characterSpacing: 1 });
    doc.moveDown(0.2).fillColor(INK).font("Helvetica-Bold").fontSize(rep.statement ? 22 : 17).text(pdfSafe(rep.title));
    if (rep.subtitle) doc.font("Helvetica").fontSize(10).fillColor(MUTED).text(pdfSafe(rep.subtitle));
    doc.moveDown(0.6);
    for (const [k, v] of rep.meta ?? []) { doc.font("Helvetica-Bold").fontSize(10).fillColor(INK).text(`${pdfSafe(k)}: `, { continued: true }).font("Helvetica").text(pdfSafe(v)); }
    doc.moveDown(0.8);

    headerRow(rep.columns);
    let n = 0;
    for await (const r of rep.rows) { dataRow(rep.columns, r); n++; }
    if (n === 0) doc.font("Helvetica-Oblique").fontSize(10).fillColor(MUTED).text("No records for this period.", 44);

    const a = rep.after?.();
    if (a) {
      if (doc.y > doc.page.height - 140) doc.addPage();
      doc.moveDown(1);
      const boxY = doc.y; const h = 16 + a.summary.length * 16;
      doc.roundedRect(40, boxY, W(), h, 4).lineWidth(0.8).strokeColor(LINE).stroke();
      a.summary.forEach(([k, v], i) => {
        const y = boxY + 8 + i * 16; const bold = i === a.summary.length - 1 && rep.statement;
        doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 12 : 10).fillColor(INK).text(pdfSafe(k), 52, y, { width: W() / 2, lineBreak: false });
        doc.text(pdfSafe(v), 40 + W() / 2, y, { width: W() / 2 - 12, align: "right", lineBreak: false });
      });
      doc.y = boxY + h + 12;
      for (const t of a.tables ?? []) {
        if (doc.y > doc.page.height - 100) doc.addPage();
        doc.moveDown(0.8).font("Helvetica-Bold").fontSize(12).fillColor(INK).text(pdfSafe(t.title), 40, doc.y, { width: W() }); doc.moveDown(0.3);
        headerRow(t.columns); t.rows.forEach((r) => dataRow(t.columns, r));
      }
    }
    if (rep.statement) doc.moveDown(2).font("Helvetica-Oblique").fontSize(9).fillColor(MUTED).text("Thank you for your faithful giving. This statement lists recorded payments only.", 40, undefined, { width: W() });
    doc.end();
  })().catch((e) => pass.destroy(e));
  return Readable.toWeb(pass) as unknown as ReadableStream<Uint8Array>;
}
