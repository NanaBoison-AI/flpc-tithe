export const DEFAULT_TZ = "Africa/Accra";

/** YYYY-MM-DD for the given instant in the given timezone. */
export function dateInTz(d: Date, tz = DEFAULT_TZ): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return p; // en-CA => YYYY-MM-DD
}
export const todayInTz = (tz = DEFAULT_TZ, now = new Date()) => dateInTz(now, tz);
export const monthKey = (paymentDate: string) => paymentDate.slice(0, 7);
export const isFutureDate = (paymentDate: string, tz = DEFAULT_TZ, now = new Date()) => paymentDate > todayInTz(tz, now);

export function monthRange(key: string): { from: string; to: string } {
  const [y, m] = key.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${key}-01`, to: `${key}-${String(last).padStart(2, "0")}` };
}
export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
export function presetRange(preset: "this_month" | "last_month" | "this_year", tz = DEFAULT_TZ, now = new Date()) {
  const today = todayInTz(tz, now);
  const cur = monthKey(today);
  if (preset === "this_month") return monthRange(cur);
  if (preset === "last_month") return monthRange(shiftMonth(cur, -1));
  const y = today.slice(0, 4);
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
export const monthName = (key: string) => MONTHS[Number(key.slice(5, 7)) - 1];

function tzOffsetMs(tz: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }).formatToParts(at);
  const g = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second")) - Math.floor(at.getTime() / 1000) * 1000;
}
/** UTC instant at which the given local calendar day starts in tz. */
export function dayStartUtc(date: string, tz = DEFAULT_TZ): Date {
  const [y, m, d] = date.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  const first = guess - tzOffsetMs(tz, new Date(guess));
  return new Date(guess - tzOffsetMs(tz, new Date(first)));
}
/** Exclusive end: start of the next local day. */
export function dayEndUtc(date: string, tz = DEFAULT_TZ): Date {
  const next = new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10) + 1)).toISOString().slice(0, 10);
  return dayStartUtc(next, tz);
}

/** Display an ISO timestamp in the church's timezone, e.g. "08 Mar 2026, 14:05". */
export function formatDateTime(iso: string | null | undefined, tz = DEFAULT_TZ): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
}
