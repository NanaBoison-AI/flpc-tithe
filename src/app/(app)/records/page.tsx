"use client";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, useAuth } from "@/lib/auth/AuthProvider";
import { useToast } from "@/components/Toast";
import { MemberPicker, type PickedMember } from "@/components/MemberPicker";
import { downloadExport } from "@/lib/download";
import { formatMoney } from "@/lib/money";
import { presetRange, todayInTz } from "@/lib/time";
import { METHOD_LABEL, PAYMENT_METHODS } from "@/lib/tithes/schema";

interface Row { id: string; paymentDate: string; memberName: string; amount: number; currency: string; method: string; reference?: string; note?: string; status: "active" | "voided"; smsStatus: string; recordedBy: string; voidReason?: string }
interface Result { rows: Row[]; count: number; sum: number; voided: number; truncated: boolean; total: number }
type Preset = "this_month" | "last_month" | "this_year" | "custom";

export default function RecordsPage() {
  const { role } = useAuth();
  const toast = useToast();
  const [tz, setTz] = useState("Africa/Accra");
  const [preset, setPreset] = useState<Preset>("this_month");
  const [range, setRange] = useState(() => presetRange("this_month"));
  const [member, setMember] = useState<PickedMember | null>(null);
  const [method, setMethod] = useState(""); const [status, setStatus] = useState("active"); const [sms, setSms] = useState("");
  const [res, setRes] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState("");
  const [edit, setEdit] = useState<Row | null>(null);
  const [ef, setEf] = useState({ amount: "", paymentDate: "", paymentMethod: "cash", reference: "", note: "" });

  useEffect(() => { (async () => { const r = await apiFetch("/api/settings"); if (r.ok) { const s = await r.json(); setTz(s.timezone); } })(); }, []);
  useEffect(() => { if (preset !== "custom") setRange(presetRange(preset, tz)); }, [preset, tz]);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ from: range.from, to: range.to, status });
    if (member) p.set("memberId", member.id); if (method) p.set("method", method); if (sms) p.set("smsStatus", sms);
    const r = await apiFetch(`/api/records?${p}`);
    setLoading(false);
    if (r.ok) setRes(await r.json()); else { const j = await r.json().catch(() => ({})); toast("error", j.issues?.[0]?.message ?? j.error ?? "Could not load records"); }
  }, [range, member, method, status, sms, toast]);
  useEffect(() => { load(); }, [load]);

  async function exportAs(type: "period" | "member", format: "csv" | "xlsx" | "pdf") {
    if (type === "member" && !member) { toast("error", "Choose a member first"); return; }
    setExporting(`${type}-${format}`);
    const err = await downloadExport({ type, format, from: range.from, to: range.to, includeVoided: String(status !== "active"), ...(type === "member" ? { memberId: member!.id } : {}) });
    setExporting("");
    toast(err ? "error" : "success", err ?? "Export ready");
  }
  async function voidRow(r: Row) {
    const reason = window.prompt(`Void ${r.memberName}'s ${formatMoney(r.amount, r.currency)} on ${r.paymentDate}?\nEnter a reason (required):`);
    if (!reason?.trim()) return;
    const x = await apiFetch(`/api/tithes/${r.id}/void`, { method: "POST", body: JSON.stringify({ reason }) });
    if (x.ok) { toast("success", "Record voided"); load(); } else { const j = await x.json().catch(() => ({})); toast("error", j.issues?.[0]?.message ?? j.error ?? "Could not void"); }
  }
  function openEdit(r: Row) { setEdit(r); setEf({ amount: (r.amount / 100).toFixed(2), paymentDate: r.paymentDate, paymentMethod: r.method, reference: r.reference ?? "", note: r.note ?? "" }); }
  async function saveEdit(e: React.FormEvent) {
    e.preventDefault(); if (!edit) return;
    const x = await apiFetch(`/api/tithes/${edit.id}`, { method: "PATCH", body: JSON.stringify(ef) });
    if (x.ok) { toast("success", "Record updated"); setEdit(null); load(); } else { const j = await x.json().catch(() => ({})); toast("error", j.issues?.[0]?.message ?? j.error ?? "Could not update"); }
  }

  const isAdmin = role === "admin";
  const today = todayInTz(tz);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Records</h1>
      <div className="card space-y-3">
        <div className="flex flex-wrap gap-2">
          {([["this_month", "This month"], ["last_month", "Last month"], ["this_year", "This year"], ["custom", "Custom"]] as [Preset, string][]).map(([k, l]) => (
            <button key={k} className={preset === k ? "btn" : "btn-secondary"} onClick={() => setPreset(k)}>{l}</button>))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="from">From</label><input id="from" type="date" className="input" max={today} value={range.from} onChange={(e) => { setPreset("custom"); setRange({ ...range, from: e.target.value }); }} /></div>
          <div><label className="label" htmlFor="to">To</label><input id="to" type="date" className="input" max={today} value={range.to} onChange={(e) => { setPreset("custom"); setRange({ ...range, to: e.target.value }); }} /></div>
        </div>
        <div><label className="label">Member</label><MemberPicker value={member} onChange={setMember} /></div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="label" htmlFor="pm">Method</label><select id="pm" className="input" value={method} onChange={(e) => setMethod(e.target.value)}><option value="">All</option>{PAYMENT_METHODS.map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}</select></div>
          <div><label className="label" htmlFor="st">Status</label><select id="st" className="input" value={status} onChange={(e) => setStatus(e.target.value)}><option value="active">Active</option><option value="all">Include voided</option><option value="voided">Voided only</option></select></div>
          <div><label className="label" htmlFor="sm">SMS</label><select id="sm" className="input" value={sms} onChange={(e) => setSms(e.target.value)}><option value="">All</option><option value="sent">Sent</option><option value="failed">Failed</option><option value="pending">Pending</option><option value="skipped">Skipped</option></select></div>
        </div>
      </div>

      <div className="card flex flex-wrap items-center gap-x-6 gap-y-1">
        <p><span className="text-sm text-slate-600">Payments </span><b>{res?.count ?? "–"}</b></p>
        <p><span className="text-sm text-slate-600">Total </span><b>{res ? formatMoney(res.sum) : "–"}</b></p>
        {res && res.voided > 0 && <p className="text-sm text-slate-600">{res.voided} voided (not counted)</p>}
        {loading && <p className="text-sm text-slate-500">Loading…</p>}
      </div>

      <div className="card space-y-2">
        <h2 className="font-semibold">Export this period</h2>
        <p className="text-sm text-slate-600">{status !== "active" ? "Voided records are included and clearly marked; they never count towards totals." : "Voided records are excluded."}</p>
        <div className="flex flex-wrap items-center gap-2"><span className="w-full text-sm font-medium sm:w-auto">All payers:</span>
          {(["csv", "xlsx", "pdf"] as const).map((f) => <button key={f} className="btn-secondary" disabled={!!exporting} onClick={() => exportAs("period", f)}>{exporting === `period-${f}` ? "…" : f.toUpperCase()}</button>)}</div>
        <div className="flex flex-wrap items-center gap-2"><span className="w-full text-sm font-medium sm:w-auto">{member ? `${member.fullName}'s statement:` : "Member statement (choose a member above):"}</span>
          {(["csv", "xlsx", "pdf"] as const).map((f) => <button key={f} className="btn-secondary" disabled={!!exporting || !member} onClick={() => exportAs("member", f)}>{exporting === `member-${f}` ? "…" : f.toUpperCase()}</button>)}</div>
      </div>

      {edit && (
        <form onSubmit={saveEdit} className="card space-y-3">
          <h2 className="font-semibold">Edit record — {edit.memberName}</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label" htmlFor="ea">Amount</label><input id="ea" className="input" inputMode="decimal" value={ef.amount} onChange={(e) => setEf({ ...ef, amount: e.target.value })} /></div>
            <div><label className="label" htmlFor="ed">Date</label><input id="ed" type="date" max={today} className="input" value={ef.paymentDate} onChange={(e) => setEf({ ...ef, paymentDate: e.target.value })} /></div>
            <div><label className="label" htmlFor="em">Method</label><select id="em" className="input" value={ef.paymentMethod} onChange={(e) => setEf({ ...ef, paymentMethod: e.target.value })}>{PAYMENT_METHODS.map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}</select></div>
            <div><label className="label" htmlFor="er">Reference</label><input id="er" className="input" value={ef.reference} onChange={(e) => setEf({ ...ef, reference: e.target.value })} /></div>
          </div>
          <div><label className="label" htmlFor="en">Note</label><input id="en" className="input" value={ef.note} onChange={(e) => setEf({ ...ef, note: e.target.value })} /></div>
          <p className="text-xs text-slate-600">The change is recorded in the audit log. No new SMS is sent.</p>
          <div className="flex gap-2"><button className="btn">Save changes</button><button type="button" className="btn-secondary" onClick={() => setEdit(null)}>Cancel</button></div>
        </form>
      )}

      {res === null ? <p className="text-slate-500">Loading…</p> : res.rows.length === 0 ? <p className="card text-slate-600">No records match these filters.</p> : (
        <>
          {res.truncated && <p className="rounded-lg bg-amber-100 p-3 text-sm text-amber-900">Showing the latest {res.rows.length} of {res.total} records. Totals include all of them. Narrow the filters or export to see everything.</p>}
          <ul className="space-y-2">
            {res.rows.map((r) => (
              <li key={r.id} className={`card flex flex-wrap items-center gap-2 ${r.status === "voided" ? "bg-slate-100" : ""}`}>
                <div className="mr-auto min-w-0">
                  <p className={`truncate font-medium ${r.status === "voided" ? "line-through text-slate-500" : ""}`}>{r.memberName}</p>
                  <p className="text-sm text-slate-600">{r.paymentDate} · {METHOD_LABEL[r.method as keyof typeof METHOD_LABEL] ?? r.method}{r.reference ? ` · ${r.reference}` : ""} · SMS {r.smsStatus}</p>
                  {r.status === "voided" && <p className="text-sm font-medium text-red-700">VOIDED{r.voidReason ? `: ${r.voidReason}` : ""}</p>}
                </div>
                <p className={`font-semibold ${r.status === "voided" ? "text-slate-500 line-through" : ""}`}>{formatMoney(r.amount, r.currency)}</p>
                {isAdmin && r.status === "active" && <><button className="btn-secondary" onClick={() => openEdit(r)}>Edit</button><button className="btn-secondary" onClick={() => voidRow(r)}>Void</button></>}
              </li>))}
          </ul>
        </>
      )}
    </div>
  );
}
