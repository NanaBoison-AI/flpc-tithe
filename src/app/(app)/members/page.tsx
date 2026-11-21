"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, useAuth } from "@/lib/auth/AuthProvider";
import { useToast } from "@/components/Toast";

interface Member { id: string; fullName: string; phone: string; memberNumber?: string; status: "active" | "inactive" }
const blank = { fullName: "", phone: "", memberNumber: "" };

export default function MembersPage() {
  const { role } = useAuth();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"active" | "inactive" | "all">("active");
  const [list, setList] = useState<Member[] | null>(null);
  const [editing, setEditing] = useState<{ id?: string } | null>(null);
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await apiFetch(`/api/members?${new URLSearchParams({ q, status, limit: "50" })}`);
    if (r.ok) setList((await r.json()).members); else toast("error", "Could not load members");
  }, [q, status, toast]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  function open(m?: Member) {
    setEditing({ id: m?.id });
    setForm(m ? { fullName: m.fullName, phone: m.phone, memberNumber: m.memberNumber ?? "" } : blank);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const body = editing?.id
      ? { fullName: form.fullName, phone: form.phone, memberNumber: form.memberNumber.trim() || null }
      : { fullName: form.fullName, phone: form.phone, memberNumber: form.memberNumber };
    const r = await apiFetch(editing?.id ? `/api/members/${editing.id}` : "/api/members", { method: editing?.id ? "PATCH" : "POST", body: JSON.stringify(body) });
    setBusy(false);
    if (r.ok) { toast("success", "Member saved"); setEditing(null); load(); }
    else { const j = await r.json().catch(() => ({})); toast("error", j.issues?.[0]?.message ?? j.error ?? "Could not save"); }
  }
  async function toggle(m: Member) {
    const next = m.status === "active" ? "inactive" : "active";
    if (next === "inactive" && !confirm(`Deactivate ${m.fullName}?`)) return;
    const r = await apiFetch(`/api/members/${m.id}`, { method: "PATCH", body: JSON.stringify({ status: next }) });
    if (r.ok) { toast("success", next === "active" ? "Member reactivated" : "Member deactivated"); load(); } else toast("error", "Could not update");
  }

  const isAdmin = role === "admin";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-bold">Members</h1>
        {isAdmin && <><Link href="/members/import" className="btn-secondary">Import CSV</Link><button className="btn" onClick={() => open()}>Add member</button></>}
      </div>
      <div className="flex gap-2">
        <input className="input" placeholder="Search name, phone or member number" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search members" />
        <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Status filter">
          <option value="active">Active</option><option value="inactive">Inactive</option><option value="all">All</option>
        </select>
      </div>

      {editing && isAdmin && (
        <form onSubmit={save} className="card space-y-3">
          <h2 className="font-semibold">{editing.id ? "Edit member" : "New member"}</h2>
          <div><label className="label" htmlFor="fn">Full name</label><input id="fn" className="input" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></div>
          <div><label className="label" htmlFor="ph">Phone</label><input id="ph" className="input" inputMode="tel" required placeholder="024 123 4567" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><label className="label" htmlFor="mn">Member number (optional)</label><input id="mn" className="input" value={form.memberNumber} onChange={(e) => setForm({ ...form, memberNumber: e.target.value })} /></div>
          <div className="flex gap-2"><button className="btn" disabled={busy}>{busy ? "Saving…" : "Save"}</button><button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button></div>
        </form>
      )}

      {list === null ? <p className="text-slate-500">Loading…</p> : list.length === 0 ? <p className="card text-slate-600">No members found.</p> : (
        <ul className="space-y-2">
          {list.map((m) => (
            <li key={m.id} className="card flex flex-wrap items-center gap-2">
              <div className="mr-auto min-w-0">
                <p className="truncate font-medium">{m.fullName} {m.status === "inactive" && <span className="ml-1 rounded bg-slate-200 px-2 py-0.5 text-xs">inactive</span>}</p>
                <p className="text-sm text-slate-600">{m.phone}{m.memberNumber ? ` · #${m.memberNumber}` : ""}</p>
              </div>
              {isAdmin && <><button className="btn-secondary" onClick={() => open(m)}>Edit</button><button className="btn-secondary" onClick={() => toggle(m)}>{m.status === "active" ? "Deactivate" : "Reactivate"}</button></>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
