"use client";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, useAuth } from "@/lib/auth/AuthProvider";
import { useToast } from "@/components/Toast";
import { formatDateTime } from "@/lib/time";

interface Entry { id: string; action: string; target: string; details: Record<string, unknown>; by: string; at: string }
const ACTIONS = ["create", "edit", "void", "member_change", "template_change", "settings_change", "export", "sms_retry"];

export default function AuditPage() {
  const { role } = useAuth();
  const toast = useToast();
  const [tz, setTz] = useState("Africa/Accra");
  const [from, setFrom] = useState(""); const [to, setTo] = useState(""); const [action, setAction] = useState("");
  const [items, setItems] = useState<Entry[] | null>(null);

  useEffect(() => { (async () => { const r = await apiFetch("/api/settings"); if (r.ok) setTz((await r.json()).timezone); })(); }, []);
  const load = useCallback(async () => {
    const p = new URLSearchParams(); if (from) p.set("from", from); if (to) p.set("to", to); if (action) p.set("action", action);
    const r = await apiFetch(`/api/audit?${p}`);
    if (r.ok) setItems((await r.json()).entries); else toast("error", "Could not load the audit log");
  }, [from, to, action, toast]);
  useEffect(() => { if (role === "admin") load(); }, [load, role]);
  if (role !== "admin") return <p className="card">Only administrators can view the audit log.</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Audit log</h1>
      <div className="card grid gap-3 sm:grid-cols-3">
        <div><label className="label" htmlFor="f">From</label><input id="f" type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><label className="label" htmlFor="t">To</label><input id="t" type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div><label className="label" htmlFor="a">Action</label><select id="a" className="input" value={action} onChange={(e) => setAction(e.target.value)}><option value="">All</option>{ACTIONS.map((a) => <option key={a} value={a}>{a.replace("_", " ")}</option>)}</select></div>
      </div>
      {items === null ? <p className="text-slate-500">Loading…</p> : items.length === 0 ? <p className="card text-slate-600">No entries match.</p> : (
        <ul className="space-y-2">{items.map((e) => (
          <li key={e.id} className="card space-y-1">
            <div className="flex flex-wrap items-center gap-2"><span className="rounded bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-900">{e.action.replace("_", " ")}</span><span className="text-sm">{e.by}</span><span className="ml-auto text-xs text-slate-500">{formatDateTime(e.at, tz)}</span></div>
            <p className="break-all text-sm text-slate-600">{e.target}</p>
            {Object.keys(e.details).length > 0 && <pre className="overflow-x-auto rounded bg-slate-100 p-2 text-xs">{JSON.stringify(e.details)}</pre>}
          </li>))}</ul>)}
    </div>
  );
}
