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
