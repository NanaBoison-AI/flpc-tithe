import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("server-only", () => ({}));
import { createFakeDb } from "./helpers/fakeDb";

let fake = createFakeDb();
vi.mock("@/lib/firebase/admin", () => ({ adminDb: () => fake.db }));

import { setSmsProvider, type SmsProvider } from "@/lib/sms";
import { createTithes } from "@/lib/tithes/service";
import { sendAckForTithe, retryAllFailed } from "@/lib/sms/send";
import { invalidateSettings } from "@/lib/settings";
import { todayInTz } from "@/lib/time";

const staff = { uid: "u1", email: "rec@church.org", role: "recorder" as const };
const today = todayInTz("Africa/Accra");
const month = today.slice(0, 7);
let calls: { to: string; message: string; senderId: string }[];
let nextOk = true;
const provider: SmsProvider = {
  send: async (i) => { calls.push(i); await new Promise((r) => setTimeout(r, 5)); return nextOk ? { ok: true, response: { status: "success", code: "2000" }, providerMessageId: "P1" } : { ok: false, response: { status: "error" }, error: "Insufficient balance" }; },
  balance: async () => ({ balance: 100 }),
};
const entry = (o: Record<string, unknown> = {}) => ({ clientKey: "k".repeat(20) + Math.random().toString(36).slice(2, 8), memberId: "m1", amount: 20000, paymentDate: today, paymentMethod: "cash" as const, reference: undefined, note: undefined, notify: true, ...o });

beforeEach(() => {
  fake = createFakeDb(); calls = []; nextOk = true; invalidateSettings(); setSmsProvider(provider);
  process.env.MNOTIFY_SENDER_ID = "FLPC";
  fake.store("members").set("m1", { fullName: "Ama Mensah", phone: "233241234567", status: "active" });
  fake.store("members").set("m2", { fullName: "Kofi Old", phone: "233201111111", status: "inactive" });
});

describe("record-tithe flow (mocked SMS provider)", () => {
  it("saves the tithe, sends a rendered SMS, logs it", async () => {
    const [r] = await createTithes(staff, [entry()]);
    expect(r.ok).toBe(true);
    expect((await sendAckForTithe(r.id!)).status).toBe("sent");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ to: "233241234567", senderId: "FLPC" });
    expect(calls[0].message).toContain("Ama"); expect(calls[0].message).toContain("200.00");
    const t = fake.store("tithes").get(r.id!)!; expect(t.smsStatus).toBe("sent"); expect(t.smsLock).toBeNull();
    const log = fake.store("smsLogs").get(r.id!)!; expect(log).toMatchObject({ status: "sent", attempts: 1, providerMessageId: "P1" }); expect(log.messageText).toBe(calls[0].message);
  });

  it("uses the month's template, falling back to default; total includes this payment", async () => {
    fake.store("smsTemplates").set(month, { body: "Thanks {firstName}! {month} total {total_this_month}" });
    const a = await createTithes(staff, [entry(), entry({ amount: 10000 })]);
    await sendAckForTithe(a[1].id!);
    expect(calls[0].message).toMatch(/^Thanks Ama! .* total 300\.00$/);
    fake.store("smsTemplates").clear(); invalidateSettings();
    const b = await createTithes(staff, [entry({ amount: 5000 })]);
    await sendAckForTithe(b[0].id!);
    expect(calls[1].message).toContain("we acknowledge your tithe");
  });

  it("never double-sends on concurrent / repeated calls", async () => {
    const [r] = await createTithes(staff, [entry()]);
    const out = await Promise.all([sendAckForTithe(r.id!), sendAckForTithe(r.id!), sendAckForTithe(r.id!)]);
    expect(calls).toHaveLength(1);
    expect(out.filter((o) => o.status === "sent")).toHaveLength(1);
    expect((await sendAckForTithe(r.id!)).status).toBe("already_sent"); expect(calls).toHaveLength(1);
  });

  it("keeps the tithe when SMS fails, logs the response, and retry succeeds", async () => {
    nextOk = false;
    const [r] = await createTithes(staff, [entry()]);
    const out = await sendAckForTithe(r.id!);
    expect(out).toEqual({ status: "failed", error: "Insufficient balance" });
    expect(fake.store("tithes").get(r.id!)).toMatchObject({ status: "active", smsStatus: "failed" });
    expect(fake.store("smsLogs").get(r.id!)!.providerResponse).toEqual({ status: "error" });
    nextOk = true;
    expect((await sendAckForTithe(r.id!)).status).toBe("sent");
    expect(fake.store("smsLogs").get(r.id!)).toMatchObject({ attempts: 2, status: "sent" });
  });

  it("retryAllFailed retries only failed active records", async () => {
    nextOk = false;
    const rs = await createTithes(staff, [entry(), entry(), entry()]);
    for (const r of rs) await sendAckForTithe(r.id!);
    fake.store("tithes").get(rs[2].id!)!.status = "voided";
    nextOk = true; calls.length = 0;
    expect(await retryAllFailed()).toEqual({ attempted: 2, sent: 2, failed: 0 });
    expect(calls).toHaveLength(2);
  });

  it("respects 'don't notify', voided records and idempotent saves", async () => {
    const e = entry({ notify: false });
    const [r] = await createTithes(staff, [e]);
    expect(fake.store("tithes").get(r.id!)!.smsStatus).toBe("skipped");
    expect((await sendAckForTithe(r.id!)).status).toBe("skipped"); expect(calls).toHaveLength(0);
    const again = await createTithes(staff, [e]);
    expect(again[0]).toMatchObject({ ok: true, duplicateOfExisting: true });
    expect(fake.store("tithes").size).toBe(1);
  });

  it("rejects future dates, inactive and unknown members; other entries still save", async () => {
    const res = await createTithes(staff, [entry({ paymentDate: "2999-01-01" }), entry({ memberId: "m2" }), entry({ memberId: "nope" }), entry()]);
    expect(res.map((r) => r.ok)).toEqual([false, false, false, true]);
    expect(res[0].error).toMatch(/future/); expect(res[1].error).toMatch(/inactive/);
  });

  it("fails cleanly (record kept) if sender ID is not configured", async () => {
    delete process.env.MNOTIFY_SENDER_ID; invalidateSettings();
    const [r] = await createTithes(staff, [entry()]);
    expect((await sendAckForTithe(r.id!)).status).toBe("failed");
    expect(calls).toHaveLength(0); expect(fake.store("tithes").get(r.id!)!.status).toBe("active");
  });
});
