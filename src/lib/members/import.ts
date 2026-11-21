import { parse } from "csv-parse/sync";
import { memberCreate } from "./schema";

export interface ImportRow { line: number; fullName: string; phone?: string; memberNumber?: string; errors: string[] }

const HEADER_ALIASES: Record<string, string> = {
  name: "fullName", fullname: "fullName", "full name": "fullName",
  phone: "phone", mobile: "phone", telephone: "phone", "phone number": "phone",
  membernumber: "memberNumber", "member number": "memberNumber", "member no": "memberNumber", "member id": "memberNumber",
};

/** Parse + validate CSV text. `existingPhones` / `existingNumbers` are already in the database. */
export function parseMemberCsv(text: string, existingPhones: Set<string>, existingNumbers: Set<string>): { rows: ImportRow[]; fatal?: string } {
  let records: Record<string, string>[];
  try {
    records = parse(text.replace(/^﻿/, ""), {
      columns: (h: string[]) => h.map((x) => HEADER_ALIASES[x.trim().toLowerCase()] ?? x.trim()),
      skip_empty_lines: true, trim: true, relax_column_count: true,
    });
  } catch { return { rows: [], fatal: "Could not read the CSV file" }; }
  if (!records.length) return { rows: [], fatal: "The file has no data rows" };
  if (!("fullName" in records[0]) || !("phone" in records[0])) return { rows: [], fatal: "CSV needs 'name' and 'phone' columns (and optional 'member number')" };
  if (records.length > 2000) return { rows: [], fatal: "Maximum 2000 rows per import" };

  const seenPhones = new Set<string>(); const seenNumbers = new Set<string>();
  const rows = records.map((r, i): ImportRow => {
    const line = i + 2; // header is line 1
    const parsed = memberCreate.safeParse({ fullName: r.fullName ?? "", phone: r.phone ?? "", memberNumber: r.memberNumber });
    if (!parsed.success) return { line, fullName: r.fullName ?? "", errors: parsed.error.issues.map((x) => `${String(x.path[0])}: ${x.message}`) };
    const d = parsed.data; const errors: string[] = [];
    if (existingPhones.has(d.phone)) errors.push("phone already exists");
    else if (seenPhones.has(d.phone)) errors.push("duplicate phone in file");
    if (d.memberNumber) {
      if (existingNumbers.has(d.memberNumber)) errors.push("member number already exists");
      else if (seenNumbers.has(d.memberNumber)) errors.push("duplicate member number in file");
    }
    if (!errors.length) { seenPhones.add(d.phone); if (d.memberNumber) seenNumbers.add(d.memberNumber); }
    return { line, fullName: d.fullName, phone: d.phone, memberNumber: d.memberNumber, errors };
  });
  return { rows };
}
