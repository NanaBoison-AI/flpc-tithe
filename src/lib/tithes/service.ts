import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { HttpError, type Staff } from "@/lib/auth/server";
import { getSettings } from "@/lib/settings";
import { isFutureDate } from "@/lib/time";
import type { TitheEntry } from "./schema";

const tithes = () => adminDb().collection("tithes");

export interface TitheDoc {
  id: string; memberId: string; memberNameSnapshot: string; phoneSnapshot: string; amount: number; currency: string;
  paymentDate: string; paymentMethod: string; reference?: string; note?: string;
  recordedBy: { uid: string; email: string }; createdAt: Date; status: "active" | "voided";
  smsStatus: "pending" | "sent" | "failed" | "skipped"; smsLogId?: string | null;
  voidedBy?: { uid: string; email: string }; voidReason?: string;
}

const toApi = (id: string, d: FirebaseFirestore.DocumentData) => ({
  ...d, id, createdAt: d.createdAt?.toDate?.().toISOString() ?? null, voidedAt: d.voidedAt?.toDate?.().toISOString() ?? null,
});

export interface CreateResult { clientKey: string; ok: boolean; id?: string; duplicateOfExisting?: boolean; error?: string; notify?: boolean }

/** Save a batch. One failing entry never blocks the others. Idempotent per clientKey. */
export async function createTithes(staff: Staff, entries: TitheEntry[]): Promise<CreateResult[]> {
  const s = await getSettings();
  const results: CreateResult[] = [];
  const memberCache = new Map<string, FirebaseFirestore.DocumentData | null>();
  for (const e of entries) {
    try {
      if (isFutureDate(e.paymentDate, s.timezone)) throw new HttpError(400, "Payment date cannot be in the future");
      if (!memberCache.has(e.memberId)) { const m = await adminDb().collection("members").doc(e.memberId).get(); memberCache.set(e.memberId, m.exists ? m.data()! : null); }
      const m = memberCache.get(e.memberId);
      if (!m) throw new HttpError(404, "Member not found");
      if (m.status !== "active") throw new HttpError(400, "Member is inactive");
      const ref = tithes().doc(e.clientKey);
      const doc = {
        memberId: e.memberId, memberNameSnapshot: m.fullName, phoneSnapshot: m.phone,
        amount: e.amount, currency: s.defaultCurrency, paymentDate: e.paymentDate, paymentMethod: e.paymentMethod,
        ...(e.reference ? { reference: e.reference } : {}), ...(e.note ? { note: e.note } : {}),
        recordedBy: { uid: staff.uid, email: staff.email }, createdAt: new Date(), status: "active",
        smsStatus: e.notify ? "pending" : "skipped", smsLogId: null,
      };
      try { await ref.create(doc); }
      catch (err: any) {
        if (err?.code === 6 || /already exists/i.test(err?.message ?? "")) { results.push({ clientKey: e.clientKey, ok: true, id: ref.id, duplicateOfExisting: true }); continue; }
        throw err;
      }
      results.push({ clientKey: e.clientKey, ok: true, id: ref.id, notify: e.notify });
    } catch (err: any) {
      results.push({ clientKey: e.clientKey, ok: false, error: err instanceof HttpError ? err.message : "Could not save" });
    }
  }
  return results;
}

export async function listByDate(date: string) {
  const snap = await tithes().where("paymentDate", "==", date).get();
  const items = snap.docs.map((d) => toApi(d.id, d.data())).sort((a: any, b: any) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  const active = items.filter((i: any) => i.status === "active");
  return { items, count: active.length, total: active.reduce((n: number, i: any) => n + i.amount, 0) };
}

/** Likely duplicate = same member, same date, same amount, still active. */
export async function findDuplicates(checks: { memberId: string; paymentDate: string; amount: number }[]) {
  return Promise.all(checks.map(async (c) => {
    const snap = await tithes().where("memberId", "==", c.memberId).where("paymentDate", "==", c.paymentDate).get();
    return snap.docs.some((d) => d.data().status === "active" && d.data().amount === c.amount);
  }));
}

export async function editTithe(staff: Staff, id: string, patch: Record<string, unknown>) {
  const s = await getSettings();
  if (typeof patch.paymentDate === "string" && isFutureDate(patch.paymentDate, s.timezone)) throw new HttpError(400, "Payment date cannot be in the future");
  const ref = tithes().doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpError(404, "Record not found");
  const before = snap.data()!;
  if (before.status !== "active") throw new HttpError(409, "Voided records cannot be edited");
  const clean = Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, v === "" ? null : v]));
  await ref.update({ ...clean, updatedAt: new Date(), updatedBy: { uid: staff.uid, email: staff.email } });
  const changes = Object.fromEntries(Object.keys(patch).map((k) => [k, { from: before[k] ?? null, to: clean[k] ?? null }]));
  return changes;
}

export async function voidTithe(staff: Staff, id: string, reason: string) {
  const ref = tithes().doc(id);
  await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpError(404, "Record not found");
    if (snap.data()!.status === "voided") throw new HttpError(409, "Already voided");
    tx.update(ref, { status: "voided", voidReason: reason, voidedBy: { uid: staff.uid, email: staff.email }, voidedAt: new Date() });
  });
}
