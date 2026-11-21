"use client";
import { useEffect, useState } from "react";
import { apiFetch, useAuth } from "@/lib/auth/AuthProvider";
import { useToast } from "@/components/Toast";

export default function SettingsPage() {
  const { role } = useAuth();
  const toast = useToast();
  const [f, setF] = useState<{ churchName: string; senderId: string; timezone: string; defaultCurrency: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (role !== "admin") return; (async () => { const r = await apiFetch("/api/admin/settings"); if (r.ok) setF(await r.json()); })(); }, [role]);
  if (role !== "admin") return <p className="card">Only administrators can change settings.</p>;
  if (!f) return <p className="text-slate-500">Loading…</p>;
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const r = await apiFetch("/api/admin/settings", { method: "PUT", body: JSON.stringify({ churchName: f!.churchName, senderId: f!.senderId, timezone: f!.timezone, defaultCurrency: "GHS" }) });
    setBusy(false);
    if (r.ok) toast("success", "Settings saved"); else { const j = await r.json().catch(() => ({})); toast("error", j.issues?.[0]?.message ?? j.error ?? "Could not save"); }
  }
  return (
    <form onSubmit={save} className="card space-y-3">
      <h1 className="text-xl font-bold">Settings</h1>
      <div><label className="label" htmlFor="cn">Church name (used in SMS)</label><input id="cn" className="input" required value={f.churchName} onChange={(e) => setF({ ...f, churchName: e.target.value })} /></div>
      <div><label className="label" htmlFor="sid">SMS sender ID (max 11 characters, must be registered with mNotify)</label><input id="sid" className="input" maxLength={11} value={f.senderId} onChange={(e) => setF({ ...f, senderId: e.target.value })} /></div>
      <div><label className="label" htmlFor="tz">Timezone</label><input id="tz" className="input" value={f.timezone} onChange={(e) => setF({ ...f, timezone: e.target.value })} /></div>
      <p className="text-sm text-slate-600">Currency: {f.defaultCurrency}</p>
      <button className="btn w-full" disabled={busy}>{busy ? "Saving…" : "Save settings"}</button>
    </form>
  );
}
