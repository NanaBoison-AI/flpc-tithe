import "server-only";
import { FieldPath } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { rowMatches, type RecordFilters, type TitheRow } from "./filters";

const PAGE = 500;
export const toRow = (id: string, d: FirebaseFirestore.DocumentData): TitheRow => ({
  id, paymentDate: d.paymentDate, memberId: d.memberId, memberName: d.memberNameSnapshot, phone: d.phoneSnapshot, amount: d.amount,
  currency: d.currency ?? "GHS", method: d.paymentMethod, reference: d.reference ?? undefined, note: d.note ?? undefined,
  status: d.status, smsStatus: d.smsStatus, recordedBy: d.recordedBy?.email ?? "", voidReason: d.voidReason ?? undefined,
});

/** Read matching tithes one page at a time (bounded memory, cursor pagination). */
export async function* iterateTithes(f: RecordFilters): AsyncGenerator<TitheRow> {
  let q: FirebaseFirestore.Query = adminDb().collection("tithes").where("paymentDate", ">=", f.from).where("paymentDate", "<=", f.to);
  if (f.memberId) q = q.where("memberId", "==", f.memberId);
  q = q.orderBy("paymentDate").orderBy(FieldPath.documentId()).limit(PAGE);
  let last: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  for (;;) {
    const snap = await (last ? q.startAfter(last) : q).get();
    for (const d of snap.docs) { const r = toRow(d.id, d.data()); if (rowMatches(r, f)) yield r; }
    if (snap.size < PAGE) return;
    last = snap.docs[snap.docs.length - 1];
  }
}
