import type { SmsProvider, SmsSendResult } from "./provider";

// Verified against https://developer.bms.africa (openapi15.yaml):
//   POST {base}/sms/quick?key=KEY  JSON {recipient[], sender, message, is_schedule, schedule_date}
//   success => { status: "success", code: "2000", summary: { _id, ... } }
//   GET  {base}/balance/sms?key=KEY => { status: "success", balance, bonus }
export class MNotifyProvider implements SmsProvider {
  constructor(
    private apiKey = process.env.MNOTIFY_API_KEY ?? "",
    private baseUrl = process.env.MNOTIFY_BASE_URL ?? "https://api.mnotify.com/api"
  ) {}

  async send({ to, message, senderId }: { to: string; message: string; senderId: string }): Promise<SmsSendResult> {
    if (!this.apiKey) return { ok: false, response: null, error: "MNOTIFY_API_KEY not configured" };
    try {
      const res = await fetch(`${this.baseUrl}/sms/quick?key=${encodeURIComponent(this.apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: [to], sender: senderId, message, is_schedule: false, schedule_date: "" }),
        signal: AbortSignal.timeout(15000),
      });
      const data: any = await res.json().catch(() => ({}));
      const ok = res.ok && data?.status === "success" && String(data?.code) === "2000";
      return {
        ok, response: data,
        providerMessageId: data?.summary?._id,
        error: ok ? undefined : data?.message ?? `HTTP ${res.status}`,
      };
    } catch (e: any) {
      return { ok: false, response: null, error: e?.name === "TimeoutError" ? "Provider timeout" : "Network error" };
    }
  }

  async balance() {
    const res = await fetch(`${this.baseUrl}/balance/sms?key=${encodeURIComponent(this.apiKey)}`, { signal: AbortSignal.timeout(10000), cache: "no-store" });
    const data: any = await res.json();
    if (data?.status !== "success") throw new Error("Balance unavailable");
    return { balance: Number(data.balance), bonus: Number(data.bonus ?? 0) };
  }
}
