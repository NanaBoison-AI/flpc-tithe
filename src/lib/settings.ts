import "server-only";
import { adminDb } from "@/lib/firebase/admin";

export interface Settings { churchName: string; senderId: string; defaultTemplate: string; defaultCurrency: string; timezone: string }
export const DEFAULT_TEMPLATE = "Dear {firstName}, we acknowledge your tithe of {currency} {amount} received on {date}. Total for {month}: {currency} {total_this_month}. God bless you. - {churchName}";

export function defaultSettings(): Settings {
  return { churchName: "Church", senderId: process.env.MNOTIFY_SENDER_ID ?? "", defaultTemplate: DEFAULT_TEMPLATE, defaultCurrency: "GHS", timezone: "Africa/Accra" };
}

let cache: { at: number; v: Settings } | null = null;
export const invalidateSettings = () => { cache = null; };

export async function getSettings(): Promise<Settings> {
  if (cache && Date.now() - cache.at < 60_000) return cache.v;
  const snap = await adminDb().collection("settings").doc("app").get();
  const base = defaultSettings();
  const d = (snap.data() ?? {}) as Partial<Settings>;
  const v: Settings = { ...base, ...Object.fromEntries(Object.entries(d).filter(([, x]) => x !== undefined && x !== "")) };
  if (!snap.exists || !d.senderId) v.senderId = d.senderId || base.senderId;
  cache = { at: Date.now(), v };
  return v;
}
