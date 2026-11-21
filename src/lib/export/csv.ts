import type { Report, Row, Col } from "./types";

/** Neutralise spreadsheet formula injection in text cells. */
const safe = (v: string) => (/^[=+\-@\t\r]/.test(v) ? `'${v}` : v);
const esc = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
function cell(c: Col, v: unknown): string {
  if (v === undefined || v === null) return "";
  if (c.type === "money") return (Number(v) / 100).toFixed(2);
  return esc(safe(String(v)));
}
export const csvLine = (cols: Col[], r: Row) => cols.map((c) => cell(c, r[c.key])).join(",") + "\r\n";

export function toCsv(rep: Report): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  const it = rep.rows[Symbol.asyncIterator]();
  let stage: "head" | "rows" | "tail" | "done" = "head";
  return new ReadableStream({
    // pull() must enqueue or close, otherwise the stream stalls; loop through stages until it does.
    async pull(ctrl) {
      for (;;) {
        if (stage === "head") { ctrl.enqueue(enc.encode("\uFEFF" + rep.columns.map((c) => esc(c.header)).join(",") + "\r\n")); stage = "rows"; return; }
        if (stage === "rows") {
          const n = await it.next();
          if (!n.done) { ctrl.enqueue(enc.encode(csvLine(rep.columns, n.value))); return; }
          stage = "tail"; continue;
        }
        const a = rep.after?.();
        if (a) {
          let out = "\r\n" + esc("Summary") + "\r\n" + a.summary.map(([k, v]) => `${esc(safe(k))},${esc(safe(v))}\r\n`).join("");
          for (const t of a.tables ?? []) out += "\r\n" + esc(t.title) + "\r\n" + t.columns.map((c) => esc(c.header)).join(",") + "\r\n" + t.rows.map((r) => csvLine(t.columns, r)).join("");
          ctrl.enqueue(enc.encode(out));
        }
        stage = "done"; ctrl.close(); return;
      }
    },
  });
}
