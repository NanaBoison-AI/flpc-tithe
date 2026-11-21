import { z } from "zod";
import { PAYMENT_METHODS } from "@/lib/tithes/schema";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");
export const recordFilters = z.object({
  from: date, to: date,
  memberId: z.string().max(64).optional(),
  method: z.enum(PAYMENT_METHODS).optional(),
  status: z.enum(["active", "voided", "all"]).default("active"),
  smsStatus: z.enum(["pending", "sent", "failed", "skipped"]).optional(),
}).refine((f) => f.from <= f.to, { message: "'From' must not be after 'To'", path: ["from"] })
  .refine((f) => (Date.parse(f.to) - Date.parse(f.from)) / 86_400_000 <= 1100, { message: "Period too long (max ~3 years)", path: ["to"] });
export type RecordFilters = z.infer<typeof recordFilters>;

export interface TitheRow {
  id: string; paymentDate: string; memberId: string; memberName: string; phone: string; amount: number; currency: string;
  method: string; reference?: string; note?: string; status: "active" | "voided"; smsStatus: string; recordedBy: string; voidReason?: string;
}

/** Filters that are applied in memory (the database query only uses date range + member). */
export function rowMatches(r: TitheRow, f: RecordFilters): boolean {
  if (f.method && r.method !== f.method) return false;
  if (f.status !== "all" && r.status !== f.status) return false;
  if (f.smsStatus && r.smsStatus !== f.smsStatus) return false;
  return true;
}
