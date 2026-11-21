/** Amounts are stored as integer pesewas. */
export function cediToPesewas(input: string | number): number {
  const n = typeof input === "number" ? input : Number(String(input).replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n <= 0) throw new Error("Invalid amount");
  return Math.round(n * 100);
}

export function formatMoney(pesewas: number, currency = "GHS"): string {
  const sign = pesewas < 0 ? "-" : "";
  const abs = Math.abs(pesewas);
  const whole = Math.floor(abs / 100).toLocaleString("en-US");
  const frac = String(abs % 100).padStart(2, "0");
  return `${sign}${currency} ${whole}.${frac}`;
}

/** Plain number string e.g. 1,250.00 (no currency) for message bodies. */
export function formatAmount(pesewas: number): string {
  return formatMoney(pesewas, "").trim();
}
