import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { HttpError } from "@/lib/auth/server";
import type { MemberInput } from "./schema";

const col = () => adminDb().collection("members");

export interface MemberLite { id: string; fullName: string; phone: string; memberNumber?: string; status: "active" | "inactive" }

export async function assertUnique(phone?: string, memberNumber?: string | null, exceptId?: string) {
  if (phone) {
    const s = await col().where("phone", "==", phone).limit(2).get();
    if (s.docs.some((d) => d.id !== exceptId)) throw new HttpError(409, "A member with this phone number already exists");
  }
  if (memberNumber) {
    const s = await col().where("memberNumber", "==", memberNumber).limit(2).get();
    if (s.docs.some((d) => d.id !== exceptId)) throw new HttpError(409, "This member number is already used");
  }
}

export async function createMember(input: MemberInput) {
  await assertUnique(input.phone, input.memberNumber);
  const now = new Date();
  const ref = col().doc();
  const data = {
    fullName: input.fullName, nameLower: input.fullName.toLowerCase(), phone: input.phone,
    ...(input.memberNumber ? { memberNumber: input.memberNumber } : {}),
    status: "active", createdAt: now, updatedAt: now,
  };
  await ref.set(data);
  return { id: ref.id, ...data };
}

export async function updateMember(id: string, patch: { fullName?: string; phone?: string; memberNumber?: string | null; status?: "active" | "inactive" }) {
  const ref = col().doc(id);
  if (!(await ref.get()).exists) throw new HttpError(404, "Member not found");
  await assertUnique(patch.phone, patch.memberNumber ?? undefined, id);
  const upd: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.fullName) { upd.fullName = patch.fullName; upd.nameLower = patch.fullName.toLowerCase(); }
  if (patch.phone) upd.phone = patch.phone;
  if (patch.status) upd.status = patch.status;
  if (patch.memberNumber !== undefined) upd.memberNumber = patch.memberNumber ?? FieldValue.delete();
  await ref.update(upd);
  return (await ref.get()).data();
}

// Short-lived cache of the lightweight member list so type-ahead doesn't re-read Firestore on every keystroke.
let cache: { at: number; list: (MemberLite & { nameLower: string })[] } | null = null;
export const invalidateMemberCache = () => { cache = null; };

async function allMembers() {
  if (cache && Date.now() - cache.at < 30_000) return cache.list;
  const list: (MemberLite & { nameLower: string })[] = [];
  let last: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  for (;;) {
    let q = col().orderBy("nameLower").select("fullName", "nameLower", "phone", "memberNumber", "status").limit(1000);
    if (last) q = q.startAfter(last);
    const s = await q.get();
    s.docs.forEach((d) => { const x = d.data(); list.push({ id: d.id, fullName: x.fullName, nameLower: x.nameLower ?? String(x.fullName).toLowerCase(), phone: x.phone, memberNumber: x.memberNumber, status: x.status }); });
    if (s.size < 1000) break;
    last = s.docs[s.docs.length - 1];
  }
  cache = { at: Date.now(), list };
  return list;
}

export async function searchMembers(q: string, status: "active" | "inactive" | "all", limit: number): Promise<MemberLite[]> {
  const term = q.trim().toLowerCase();
  const digits = term.replace(/\D/g, "");
  const list = await allMembers();
  const out: MemberLite[] = [];
  for (const m of list) {
    if (status !== "all" && m.status !== status) continue;
    if (term) {
      const hit = m.nameLower.includes(term) || (m.memberNumber ?? "").toLowerCase().includes(term) || (digits.length >= 3 && (m.phone.includes(digits) || m.phone.endsWith(digits.replace(/^0/, ""))));
      if (!hit) continue;
    }
    const { nameLower: _n, ...pub } = m; out.push(pub);
    if (out.length >= limit) break;
  }
  return out;
}

export async function existingKeys() {
  const list = await allMembers();
  return { phones: new Set(list.map((m) => m.phone)), numbers: new Set(list.flatMap((m) => (m.memberNumber ? [m.memberNumber] : []))) };
}

export async function bulkCreate(rows: { fullName: string; phone: string; memberNumber?: string }[]) {
  const now = new Date();
  for (let i = 0; i < rows.length; i += 400) {
    const batch = adminDb().batch();
    rows.slice(i, i + 400).forEach((r) => batch.set(col().doc(), {
      fullName: r.fullName, nameLower: r.fullName.toLowerCase(), phone: r.phone,
      ...(r.memberNumber ? { memberNumber: r.memberNumber } : {}), status: "active", createdAt: now, updatedAt: now,
    }));
    await batch.commit();
  }
  invalidateMemberCache();
}
