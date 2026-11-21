import type { SmsProvider } from "./provider";
import { MNotifyProvider } from "./mnotify";

let override: SmsProvider | null = null;
export const setSmsProvider = (p: SmsProvider | null) => { override = p; };
export const getSmsProvider = (): SmsProvider => override ?? new MNotifyProvider();

/** Single entry point for sending SMS. */
export async function sendSms(input: { to: string; message: string; senderId: string }) {
  return getSmsProvider().send(input);
}
export * from "./provider";
