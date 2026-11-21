import type { TitheRow } from "@/lib/records/filters";

/** Pure: month and today figures from the month's rows. Voided rows never count. */
export function summarizeMonth(rows: Iterable<TitheRow>, today: string) {
  const payers = new Set<string>(); let monthTotal = 0, monthCount = 0, todayCount = 0, todayTotal = 0;
  for (const r of rows) {
    if (r.status !== "active") continue;
    monthTotal += r.amount; monthCount++; payers.add(r.memberId);
    if (r.paymentDate === today) { todayCount++; todayTotal += r.amount; }
  }
  return { monthTotal, monthCount, payers: payers.size, todayCount, todayTotal };
}
