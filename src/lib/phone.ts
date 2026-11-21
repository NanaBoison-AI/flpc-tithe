/** Normalize Ghana numbers to 233XXXXXXXXX (12 digits). Returns null if invalid. */
export function normalizePhone(raw: string): string | null {
  let d = String(raw ?? "").replace(/[\s\-().]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (!/^\d+$/.test(d)) return null;
  if (d.startsWith("00233")) d = d.slice(2);
  if (d.startsWith("233") && d.length === 12) return d;
  if (d.startsWith("0") && d.length === 10) return "233" + d.slice(1);
  if (d.length === 9 && !d.startsWith("0")) return "233" + d;
  return null;
}
