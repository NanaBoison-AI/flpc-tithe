import { describe, it, expect } from "vitest";
import { titheEntry, titheBatch, titheVoid, titheEdit } from "@/lib/tithes/schema";

const base = { memberId: "m1", amount: "1,250.50", paymentDate: "2026-03-08", paymentMethod: "cash", clientKey: "abcdefghijklmnop1234" };
describe("tithe schema", () => {
  it("converts amount to pesewas", () => expect(titheEntry.parse(base).amount).toBe(125050));
  it("defaults notify=true, strips empty optionals", () => { const r = titheEntry.parse({ ...base, reference: "  ", note: "" }); expect(r.notify).toBe(true); expect(r.reference).toBeUndefined(); });
  it.each(["0", "-5", "abc", "1000000000"])("rejects amount %s", (a) => expect(titheEntry.safeParse({ ...base, amount: a }).success).toBe(false));
  it("rejects bad date / method / key", () => {
    expect(titheEntry.safeParse({ ...base, paymentDate: "2026-13-45" }).success).toBe(false);
    expect(titheEntry.safeParse({ ...base, paymentMethod: "bitcoin" }).success).toBe(false);
    expect(titheEntry.safeParse({ ...base, clientKey: "short" }).success).toBe(false);
  });
  it("batch limits", () => { expect(titheBatch.safeParse({ entries: [] }).success).toBe(false); expect(titheBatch.safeParse({ entries: [base] }).success).toBe(true); });
  it("void needs a reason", () => { expect(titheVoid.safeParse({ reason: " " }).success).toBe(false); expect(titheVoid.safeParse({ reason: "Wrong amount" }).success).toBe(true); });
  it("edit needs at least one field", () => { expect(titheEdit.safeParse({}).success).toBe(false); expect(titheEdit.parse({ amount: "10" }).amount).toBe(1000); });
});
