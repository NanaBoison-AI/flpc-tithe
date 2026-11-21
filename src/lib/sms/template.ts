import { formatAmount } from "@/lib/money";
import { monthName } from "@/lib/time";

export const PLACEHOLDERS = ["name","firstName","amount","currency","date","month","year","churchName","total_this_month"] as const;

export function findUnknownPlaceholders(body: string): string[] {
  const found = [...body.matchAll(/\{([^{}]*)\}/g)].map((m) => m[1]);
  return [...new Set(found.filter((f) => !(PLACEHOLDERS as readonly string[]).includes(f)))];
}

export interface TemplateVars {
  fullName: string; amount: number; totalThisMonth: number; currency: string;
  paymentDate: string; churchName: string;
}

export function renderTemplate(body: string, v: TemplateVars): string {
  const map: Record<string, string> = {
    name: v.fullName,
    firstName: v.fullName.trim().split(/\s+/)[0] ?? "",
    amount: formatAmount(v.amount),
    currency: v.currency,
    date: v.paymentDate,
    month: monthName(v.paymentDate.slice(0, 7)),
    year: v.paymentDate.slice(0, 4),
    churchName: v.churchName,
    total_this_month: formatAmount(v.totalThisMonth),
  };
  return body.replace(/\{([^{}]*)\}/g, (all, k) => (k in map ? map[k] : all));
}

const GSM7 = new Set(
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà".split("")
);
const GSM7_EXT = new Set("^{}\\[~]|€".split(""));

export function smsStats(text: string): { encoding: "GSM-7" | "Unicode"; length: number; segments: number; overOne: boolean } {
  let gsm = true; let units = 0;
  for (const ch of text) {
    if (GSM7.has(ch)) units += 1;
    else if (GSM7_EXT.has(ch)) units += 2;
    else { gsm = false; break; }
  }
  if (gsm) {
    const segments = units === 0 ? 0 : units <= 160 ? 1 : Math.ceil(units / 153);
    return { encoding: "GSM-7", length: units, segments, overOne: segments > 1 };
  }
  const len = text.length; // UTF-16 code units
  const segments = len === 0 ? 0 : len <= 70 ? 1 : Math.ceil(len / 67);
  return { encoding: "Unicode", length: len, segments, overOne: segments > 1 };
}
