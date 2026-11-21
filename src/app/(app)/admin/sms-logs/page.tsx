"use client";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, useAuth } from "@/lib/auth/AuthProvider";
import { useToast } from "@/components/Toast";
import { formatDateTime } from "@/lib/time";
import { MemberPicker, type PickedMember } from "@/components/MemberPicker";

interface Log { id: string; titheId: string; phone: string; messageText: string; status: "sent" | "failed"; attempts: number; error?: string | null; createdAt?: string; sentAt?: string | null }

export default function SmsLogsPage() {
  const { role } = useAuth();
  const toast = useToast();
  const [from, setFrom] = useState(""); const [to, setTo] = useState(""); const [status, setStatus] = useState("");
  const [member, setMember] = useState<PickedMember | null>(null);
  const [logs, setLogs] = useState<Log[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [tz, setTz] = useState("Africa/Accra");
  useEffect(() => { (async () => { const r = await apiFetch("/api/settings"); if (r.ok) setTz((await r.json()).timezone); })(); }, []);

  const load = useCallback(async () => {
    const p = new URLSearchParams(); if (from) p.set("from", from); if (to) p.set("to", to); if (status) p.set("status", status); if (member) p.set("memberId", member.id);
    const r = await apiFetch(`/api/sms/logs?${p}`);
    if (r.ok) setLogs((await r.json()).logs); else toast("error", "Could not load logs");
  }, [from, to, status, member, toast]);
  useEffect(() => { if (role === "admin") load(); }, [load, role]);
  if (role !== "admin") return <p className="card">Only administrators can view SMS logs.</p>;

  async function retryAll() {
    setBusy(true);
    const r = await apiFetch("/api/sms/retry-failed", { method: "POST" });
    setBusy(false);
    if (r.ok) { const j = await r.json(); toast(j.failed ? "error" : "success", `Retried ${j.attempted}: ${j.sent} sent, ${j.failed} failed`); load(); } else toast("error", "Retry failed");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2"><h1 className="mr-auto text-xl font-bold">SMS logs</h1><button className="btn" disabled={busy} onClick={retryAll}>{busy ? "Retrying…" : "Retry all failed"}</button></div>
      <div className="card grid gap-3 sm:grid-cols-4">
        <div><label className="label" htmlFor="f">From</label><input id="f" type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><label className="label" htmlFor="t">To</label><input id="t" type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div><label className="label" htmlFor="s">Status</label><select id="s" className="input" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All</option><option value="sent">Sent</option><option value="failed">Failed</option></select></div>
        <div><label className="label">Member</label><MemberPicker value={member} onChange={setMember} /></div>
      </div>
      {logs === null ? <p className="text-slate-500">Loading…</p> : logs.length === 0 ? <p className="card text-slate-600">No SMS logs match.</p> : (
        <ul className="space-y-2">{logs.map((l) => (
          <li key={l.id} className="card space-y-1">
            <div className="flex items-center gap-2"><span className={`rounded px-2 py-1 text-xs font-medium ${l.status === "sent" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>{l.status}</span><span className="text-sm">{l.phone}</span><span className="ml-auto text-xs text-slate-500">{l.createdAt ? formatDateTime(l.createdAt, tz) : ""} · {l.attempts} attempt{l.attempts === 1 ? "" : "s"}</span></div>
            <p className="text-sm">{l.messageText}</p>
            {l.error && <p className="text-sm text-red-700">{l.error}</p>}
          </li>))}</ul>)}
    </div>
  );
}
