import { z } from "zod";
import { cediToPesewas } from "@/lib/money";

export const PAYMENT_METHODS = ["cash", "mobile_money", "bank", "cheque", "other"] as const;
export const METHOD_LABEL: Record<(typeof PAYMENT_METHODS)[number], string> = { cash: "Cash", mobile_money: "Mobile money", bank: "Bank", cheque: "Cheque", other: "Other" };

const optText = (max: number) => z.string().trim().max(max).optional().transform((v) => v || undefined);
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date").refine((s) => !Number.isNaN(Date.parse(s + "T00:00:00Z")), "Invalid date");
const amount = z.union([z.string(), z.number()]).transform((v, ctx) => {
  try {
    const p = cediToPesewas(v);
    if (p > 100_000_000) throw new Error();
    return p;
  } catch { ctx.addIssue({ code: "custom", message: "Enter a valid amount greater than 0" }); return z.NEVER; }
});

export const tithePayload = z.object({
  memberId: z.string().min(1).max(64),
  amount, paymentDate: dateStr,
  paymentMethod: z.enum(PAYMENT_METHODS),
  reference: optText(80), note: optText(300),
  notify: z.boolean().default(true),
});
/** clientKey makes a submit idempotent: the same key can never create two tithes. */
export const titheEntry = tithePayload.extend({ clientKey: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/) });
export const titheBatch = z.object({ entries: z.array(titheEntry).min(1).max(100) });

export const titheEdit = z.object({
  amount: amount.optional(), paymentDate: dateStr.optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  reference: z.string().trim().max(80).optional(), note: z.string().trim().max(300).optional(),
}).refine((o) => Object.keys(o).length > 0, "Nothing to update");
export const titheVoid = z.object({ reason: z.string().trim().min(3, "A reason is required").max(300) });
export type TitheEntry = z.infer<typeof titheEntry>;
