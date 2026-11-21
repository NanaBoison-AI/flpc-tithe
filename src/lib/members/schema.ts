import { z } from "zod";
import { normalizePhone } from "@/lib/phone";

export const phoneField = z.string().trim().transform((v, ctx) => {
  const n = normalizePhone(v);
  if (!n) { ctx.addIssue({ code: "custom", message: "Invalid Ghana phone number" }); return z.NEVER; }
  return n;
});
const memberNumber = z.string().trim().max(30).optional().transform((v) => (v ? v : undefined));

export const memberCreate = z.object({
  fullName: z.string().trim().min(2, "Name is too short").max(120),
  phone: phoneField,
  memberNumber,
});
export const memberUpdate = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  phone: phoneField.optional(),
  memberNumber: z.string().trim().max(30).nullable().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});
export type MemberInput = z.infer<typeof memberCreate>;
