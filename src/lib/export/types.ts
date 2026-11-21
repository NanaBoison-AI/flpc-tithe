export type Row = Record<string, any> & { _voided?: boolean };
export interface Col { key: string; header: string; type?: "text" | "money" | "date"; width?: number }
export interface Report {
  filename: string;           // without extension
  title: string; subtitle?: string;
  meta?: [string, string][];  // label/value lines shown above the table
  columns: Col[];
  rows: AsyncIterable<Row>;   // money values are integer pesewas
  /** Evaluated AFTER rows have been consumed (totals need the whole set). */
  after?: () => { summary: [string, string][]; tables?: { title: string; columns: Col[]; rows: Row[] }[] };
  statement?: boolean;        // member-facing PDF styling
  currency: string; churchName: string;
}
export const FORMATS = { csv: "text/csv; charset=utf-8", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", pdf: "application/pdf" } as const;
export type Format = keyof typeof FORMATS;
