import "server-only";
import { memberDirectory } from "@/lib/members/service";
import { monthRange } from "@/lib/time";
import { iterateTithes } from "./source";

/** Active members who have no active tithe with a payment date in the given month (YYYY-MM). */
export async function unpaidMembers(month: string) {
  const { from, to } = monthRange(month);
  const paid = new Set<string>();
  for await (const r of iterateTithes({ from, to, status: "active" })) paid.add(r.memberId);
  const dir = (await memberDirectory()).filter((m) => m.status === "active");
  const members = dir.filter((m) => !paid.has(m.id)).map((m) => ({ id: m.id, fullName: m.fullName, phone: m.phone, memberNumber: m.memberNumber }));
  return { members, activeCount: dir.length, paidCount: dir.length - members.length };
}
