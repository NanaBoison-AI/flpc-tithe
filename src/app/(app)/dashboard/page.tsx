"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, useAuth } from "@/lib/auth/AuthProvider";
import { useToast } from "@/components/Toast";
import { formatMoney } from "@/lib/money";
import { monthName } from "@/lib/time";

interface D { month: string; today: string; currency: string; monthTotal: number; monthCount: number; payers: number; todayCount: number; todayTotal: number; smsFailed: number }
interface Bal { available: boolean; balance?: number; bonus?: number; threshold: number; low?: boolean }

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "warn" }) {
  return <div className={`card ${tone === "warn" ? "border-amber-400 bg-amber-50" : ""}`}><p className="text-sm text-slate-600">{label}</p><p className="text-2xl font-bold">{value}</p>{sub && <p className="text-sm text-slate-600">{sub}</p>}</div>;
}

export default function Dashboard() {
  const { role } = useAuth();
  const toast = useToast();
  const [d, setD] = useState<D | null>(null);
  const [bal, setBal] = useState<Bal | null>(null);
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await apiFetch("/api/dashboard");
    if (r.ok) { setD(await r.json()); setErr(false); } else setErr(true);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (role !== "admin") return; (async () => { const r = await apiFetch("/api/sms/balance"); if (r.ok) setBal(await r.json()); })(); }, [role]);

  async function retryAll() {
    setBusy(true);
    const r = await apiFetch("/api/sms/retry-failed", { method: "POST" });
    setBusy(false);
    if (r.ok) { const j = await r.json(); toast(j.failed ? "error" : "success", `Retried ${j.attempted}: ${j.sent} sent, ${j.failed} failed`); load(); } else toast("error", "Retry failed");
  }

  if (err) return <div className="card"><p>Could not load the dashboard.</p><button className="btn mt-3" onClick={load}>Try again</button></div>;
  if (!d) return <p className="text-slate-500">Loading…</p>;
  const cur = d.currency;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Dashboard</h1>
      {role === "admin" && bal?.available && bal.low && (
        <p role="alert" className="rounded-lg bg-red-100 p-3 font-medium text-red-900">⚠ SMS balance is low ({bal.balance} credits, below {bal.threshold}). Top up your mNotify account so acknowledgements keep sending.</p>)}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label={`${monthName(d.month)} total`} value={formatMoney(d.monthTotal, cur)} sub={`${d.monthCount} payment${d.monthCount === 1 ? "" : "s"}`} />
        <Stat label="Payers this month" value={String(d.payers)} />
        <Stat label="Today's entries" value={String(d.todayCount)} sub={formatMoney(d.todayTotal, cur)} />
        <Stat label="SMS awaiting retry" value={d.smsFailed < 0 ? "–" : String(d.smsFailed)} tone={d.smsFailed > 0 ? "warn" : undefined} />
        {role === "admin" && <Stat label="SMS balance" value={bal === null ? "…" : bal.available ? String(bal.balance) : "Unavailable"} sub={bal?.available ? (bal.bonus ? `+ ${bal.bonus} bonus` : "credits") : "Check API key"} tone={bal?.low ? "warn" : undefined} />}
      </div>
      {d.smsFailed > 0 && <button className="btn w-full sm:w-auto" disabled={busy} onClick={retryAll}>{busy ? "Retrying…" : `Retry ${d.smsFailed} failed SMS`}</button>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/record" className="btn">Record tithe</Link>
        <Link href="/reports/unpaid" className="btn-secondary">Members who haven&apos;t paid</Link>
      </div>
    </div>
  );
}
