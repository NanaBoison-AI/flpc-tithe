import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { HttpError } from "@/lib/auth/server";
import { getSettings } from "@/lib/settings";
import { monthKey, monthRange } from "@/lib/time";
import { composeAck } from "./compose";
import { sendSms } from "./index";

const LOCK_MS = 120_000;
export type SendOutcome = { status: "sent" | "failed" | "skipped" | "in_progress" | "already_sent"; error?: string };

/**
 * Send (or retry) the acknowledgement for one tithe. Idempotent per tithe ID:
 * a transactional lock prevents concurrent double-sends, and a tithe already marked
 * "sent" is never sent again. A provider failure never affects the tithe record.
 */
export async function sendAckForTithe(titheId: string): Promise<SendOutcome> {
  const db = adminDb();
  const tRef = db.collection("tithes").doc(titheId);

  type Claim = { early: Exclude<SendOutcome["status"], "sent" | "failed">; tithe?: undefined } | { early?: undefined; tithe: FirebaseFirestore.DocumentData };
  const claim: Claim = await db.runTransaction(async (tx): Promise<Claim> => {
    const snap = await tx.get(tRef);
    if (!snap.exists) throw new HttpError(404, "Record not found");
    const t = snap.data()!;
    if (t.status === "voided") throw new HttpError(409, "Cannot send SMS for a voided record");
    if (t.smsStatus === "sent") return { early: "already_sent" as const };
    if (t.smsStatus === "skipped") return { early: "skipped" as const };
    const lock = t.smsLock?.toDate?.() ?? t.smsLock;
    if (lock && Date.now() - new Date(lock).getTime() < LOCK_MS) return { early: "in_progress" as const };
    tx.update(tRef, { smsLock: new Date() });
    return { tithe: t };
  });
  if (claim.early) return { status: claim.early };
  const t = claim.tithe;

  let ok = false; let error: string | undefined; let response: unknown = null; let providerId: string | undefined; let text = "";
  try {
    const s = await getSettings();
    const month = monthKey(t.paymentDate);
    const [tplSnap, monthTithes] = await Promise.all([
      db.collection("smsTemplates").doc(month).get(),
      db.collection("tithes").where("memberId", "==", t.memberId).where("paymentDate", ">=", monthRange(month).from).where("paymentDate", "<=", monthRange(month).to).get(),
    ]);
    const total = monthTithes.docs.filter((d) => d.data().status === "active").reduce((n, d) => n + d.data().amount, 0);
    text = composeAck({
      monthTemplate: tplSnap.exists ? tplSnap.data()!.body : null, defaultTemplate: s.defaultTemplate, churchName: s.churchName, currency: t.currency,
      fullName: t.memberNameSnapshot, amount: t.amount, paymentDate: t.paymentDate, totalThisMonth: total,
    }).text;
    if (!s.senderId || s.senderId.length > 11) { error = "Sender ID is missing or longer than 11 characters"; }
    else {
      const r = await sendSms({ to: t.phoneSnapshot, message: text, senderId: s.senderId });
      ok = r.ok; response = r.response; providerId = r.providerMessageId; error = r.error;
    }
  } catch { error = "Unexpected error while sending"; }

  // Always record the outcome and release the lock, whatever happened above.
  const lRef = db.collection("smsLogs").doc(titheId);
  const prev = await lRef.get();
  const now = new Date();
  await lRef.set({
    titheId, memberId: t.memberId, phone: t.phoneSnapshot, messageText: text,
    status: ok ? "sent" : "failed", providerResponse: JSON.parse(JSON.stringify(response ?? null)), providerMessageId: providerId ?? null,
    error: ok ? null : error ?? "Unknown error", attempts: (prev.data()?.attempts ?? 0) + 1,
    createdAt: prev.data()?.createdAt ?? now, lastAttemptAt: now, sentAt: ok ? now : null,
  });
  await tRef.update({ smsStatus: ok ? "sent" : "failed", smsLogId: titheId, smsLock: null });
  return ok ? { status: "sent" } : { status: "failed", error };
}

export async function mapLimit<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

/** Retry every failed acknowledgement (and any that got stuck pending for >2 min). */
export async function retryAllFailed(max = 100) {
  const col = adminDb().collection("tithes");
  const [failed, pending] = await Promise.all([col.where("smsStatus", "==", "failed").limit(max).get(), col.where("smsStatus", "==", "pending").limit(max).get()]);
  const cutoff = Date.now() - LOCK_MS;
  const ids = [...failed.docs, ...pending.docs.filter((d) => (d.data().createdAt?.toDate?.() ?? new Date(d.data().createdAt)).getTime() < cutoff)]
    .filter((d) => d.data().status === "active").slice(0, max).map((d) => d.id);
  const results = await mapLimit(ids, 4, (id) => sendAckForTithe(id).catch(() => ({ status: "failed" as const })));
  return { attempted: ids.length, sent: results.filter((r) => r.status === "sent").length, failed: results.filter((r) => r.status === "failed").length };
}
