"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/auth/AuthProvider";
import { useToast } from "@/components/Toast";
import { MemberPicker, type PickedMember } from "@/components/MemberPicker";
import { formatMoney, cediToPesewas } from "@/lib/money";
import { todayInTz } from "@/lib/time";
import { METHOD_LABEL, PAYMENT_METHODS } from "@/lib/tithes/schema";

type Method = (typeof PAYMENT_METHODS)[number];
interface Draft { key: string; member: PickedMember; amount: string; paymentDate: string; paymentMethod: Method; reference: string; note: string; notify: boolean; duplicate?: boolean }
interface Row { id: string; memberNameSnapshot: string; amount: number; currency: string; paymentMethod: string; status: string; smsStatus: string; reference?: string }
const newKey = () => crypto.randomUUID().replace(/-/g, "");
const SMS_BADGE: Record<string, string> = { sent: "bg-emerald-100 text-emerald-800", failed: "bg-red-100 text-red-800", pending: "bg-amber-100 text-amber-800", skipped: "bg-slate-200 text-slate-700" };

export default function RecordPage() {
  const toast = useToast();
  const [tz, setTz] = useState("Africa/Accra");
  const [currency, setCurrency] = useState("GHS");
  const today = useMemo(() => todayInTz(tz), [tz]);
  const [member, setMember] = useState<PickedMember | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [method, setMethod] = useState<Method>("cash");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(true);
  const [batch, setBatch] = useState<Draft[]>([]);
  const [busy, setBusy] = useState(false);
  const [day, setDay] = useState<{ items: Row[]; count: number; total: number } | null>(null);
  const [dupWarn, setDupWarn] = useState(false);

  useEffect(() => { (async () => { const r = await apiFetch("/api/settings"); if (r.ok) { const s = await r.json(); setTz(s.timezone); setCurrency(s.defaultCurrency); } })(); }, []);
  useEffect(() => { if (!date) setDate(today); }, [today, date]);

  const loadDay = useCallback(async () => {
    if (!date) return;
    const r = await apiFetch(`/api/tithes?date=${date}`);
    if (r.ok) setDay(await r.json());
  }, [date]);
  useEffect(() => { loadDay(); }, [loadDay]);

  // Warn (never block) on a likely duplicate: same member, date and amount.
  useEffect(() => {
    setDupWarn(false);
    if (!member || !amount || !date) return;
    let p: number; try { p = cediToPesewas(amount); } catch { return; }
    const t = setTimeout(async () => {
      const r = await apiFetch("/api/tithes/duplicates", { method: "POST", body: JSON.stringify({ checks: [{ memberId: member.id, paymentDate: date, amount: p }] }) });
      if (r.ok) setDupWarn((await r.json()).duplicates[0]);
    }, 400);
    return () => clearTimeout(t);
  }, [member, amount, date]);

  function currentDraft(): Draft | null {
    if (!member) { toast("error", "Choose a member"); return null; }
    try { cediToPesewas(amount); } catch { toast("error", "Enter a valid amount"); return null; }
    if (date > today) { toast("error", "Date cannot be in the future"); return null; }
    return { key: newKey(), member, amount, paymentDate: date, paymentMethod: method, reference, note, notify, duplicate: dupWarn };
  }
  function resetForm() { setMember(null); setAmount(""); setReference(""); setNote(""); setDupWarn(false); }

  async function submit(drafts: Draft[]) {
    setBusy(true);
    const r = await apiFetch("/api/tithes", { method: "POST", body: JSON.stringify({ entries: drafts.map((d) => ({ clientKey: d.key, memberId: d.member.id, amount: d.amount, paymentDate: d.paymentDate, paymentMethod: d.paymentMethod, reference: d.reference, note: d.note, notify: d.notify })) }) });
    setBusy(false);
    if (!r.ok) { const j = await r.json().catch(() => ({})); toast("error", j.issues?.[0]?.message ?? j.error ?? "Could not save"); return false; }
    const { results } = await r.json() as { results: { clientKey: string; ok: boolean; error?: string }[] };
    const okKeys = new Set(results.filter((x) => x.ok).map((x) => x.clientKey));
    const bad = results.filter((x) => !x.ok);
    if (okKeys.size) toast("success", `${okKeys.size} ${okKeys.size === 1 ? "tithe" : "tithes"} saved`);
    bad.forEach((b) => toast("error", b.error ?? "An entry failed"));
    setBatch((cur) => cur.filter((d) => !okKeys.has(d.key)));
    loadDay();
    return bad.length === 0;
  }

  async function retrySms(id: string) {
    const r = await apiFetch(`/api/tithes/${id}/send-sms`, { method: "POST" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) toast("error", j.error ?? "Retry failed");
    else if (j.status === "sent" || j.status === "already_sent") toast("success", "SMS sent");
    else if (j.status === "in_progress") toast("error", "A send is already in progress");
    else toast("error", `SMS failed: ${j.error ?? "unknown error"}`);
    loadDay();
  }
  async function saveNow() { const d = currentDraft(); if (d && (await submit([d]))) resetForm(); }
  function addToBatch() { const d = currentDraft(); if (d) { setBatch((b) => [...b, d]); resetForm(); } }
  const batchTotal = batch.reduce((n, d) => n + cediToPesewas(d.amount), 0);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Record tithe</h1>
      <div className="card space-y-3">
        <div><label className="label">Member</label><MemberPicker value={member} onChange={setMember} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="amt">Amount ({currency})</label><input id="amt" className="input" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div><label className="label" htmlFor="dt">Payment date</label><input id="dt" className="input" type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="pm">Method</label>
            <select id="pm" className="input" value={method} onChange={(e) => setMethod(e.target.value as Method)}>{PAYMENT_METHODS.map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}</select></div>
          <div><label className="label" htmlFor="ref">Reference</label><input id="ref" className="input" value={reference} onChange={(e) => setReference(e.target.value)} /></div>
        </div>
        <div><label className="label" htmlFor="nt">Note</label><input id="nt" className="input" value={note} onChange={(e) => setNote(e.target.value)} /></div>
        <label className="flex min-h-12 items-center gap-3"><input type="checkbox" className="h-6 w-6" checked={!notify} onChange={(e) => setNotify(!e.target.checked)} /> Don&apos;t send SMS acknowledgement</label>
        {dupWarn && <p role="alert" className="rounded-lg bg-amber-100 p-3 text-sm text-amber-900">⚠ This member already has a tithe of the same amount on this date. You can still save it.</p>}
        <div className="flex flex-wrap gap-2">
          <button className="btn flex-1" disabled={busy} onClick={saveNow}>{notify ? "Save & send acknowledgement" : "Save"}</button>
          <button className="btn-secondary flex-1" disabled={busy} onClick={addToBatch}>Add to batch</button>
        </div>
      </div>

      {batch.length > 0 && (
        <div className="card space-y-3">
          <h2 className="font-semibold">Batch ({batch.length}) · {formatMoney(batchTotal, currency)}</h2>
          <ul className="divide-y">
            {batch.map((d) => (
              <li key={d.key} className="flex items-center gap-2 py-2">
                <div className="mr-auto min-w-0"><p className="truncate font-medium">{d.member.fullName}</p>
                  <p className="text-sm text-slate-600">{formatMoney(cediToPesewas(d.amount), currency)} · {METHOD_LABEL[d.paymentMethod]} · {d.paymentDate}{!d.notify && " · no SMS"}</p>
                  {d.duplicate && <p className="text-xs text-amber-800">⚠ possible duplicate</p>}</div>
                <button className="btn-secondary" onClick={() => setBatch((b) => b.filter((x) => x.key !== d.key))} aria-label={`Remove ${d.member.fullName}`}>Remove</button>
              </li>
            ))}
          </ul>
          <button className="btn w-full" disabled={busy} onClick={() => submit(batch)}>{busy ? "Saving…" : `Submit all (${batch.length})`}</button>
        </div>
      )}

      <div className="card space-y-2">
        <div className="flex items-baseline justify-between"><h2 className="font-semibold">{date === today ? "Today's entries" : `Entries for ${date}`}</h2>
          <p className="font-semibold">{day ? `${day.count} · ${formatMoney(day.total, currency)}` : ""}</p></div>
        {day === null ? <p className="text-slate-500">Loading…</p> : day.items.length === 0 ? <p className="text-slate-600">No entries yet.</p> : (
          <ul className="divide-y">{day.items.map((i) => (
            <li key={i.id} className={`flex items-center gap-2 py-2 ${i.status === "voided" ? "opacity-50 line-through" : ""}`}>
              <div className="mr-auto min-w-0"><p className="truncate font-medium">{i.memberNameSnapshot}</p><p className="text-sm text-slate-600">{METHOD_LABEL[i.paymentMethod as Method] ?? i.paymentMethod}{i.reference ? ` · ${i.reference}` : ""}</p></div>
              <p className="font-medium">{formatMoney(i.amount, i.currency)}</p>
              {i.status === "active" && <span className={`rounded px-2 py-1 text-xs font-medium ${SMS_BADGE[i.smsStatus]}`}>SMS {i.smsStatus}</span>}
              {i.status === "active" && (i.smsStatus === "failed" || i.smsStatus === "pending") && <button className="btn-secondary" onClick={() => retrySms(i.id)}>Retry SMS</button>}
            </li>))}</ul>)}
      </div>
    </div>
  );
}
