import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { getSettings } from "@/lib/settings";
import { monthKey, monthRange, todayInTz } from "@/lib/time";
import { iterateTithes } from "@/lib/records/source";
import { summarizeMonth } from "./dashboard";

// One scan of the month serves every dashboard viewer for 60s, which keeps Firestore reads low.
let cache: { key: string; at: number; v: ReturnType<typeof summarizeMonth> } | null = null;
export const invalidateDashboard = () => { cache = null; };

export async function getDashboard() {
  const s = await getSettings();
  const today = todayInTz(s.timezone); const month = monthKey(today);
  const key = `${month}|${today}`;
  if (!cache || cache.key !== key || Date.now() - cache.at > 60_000) {
    const rows = []; for await (const r of iterateTithes({ ...monthRange(month), status: "active" })) rows.push(r);
    cache = { key, at: Date.now(), v: summarizeMonth(rows, today) };
  }
  // Cheap aggregate: counts index entries, not documents.
  let smsFailed = 0;
  try {
    const c = await adminDb().collection("tithes").where("smsStatus", "==", "failed").where("status", "==", "active").count().get();
    smsFailed = c.data().count;
  } catch { smsFailed = -1; }
  return { month, today, currency: s.defaultCurrency, ...cache.v, smsFailed };
}
