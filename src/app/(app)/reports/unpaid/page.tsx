"use client";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/auth/AuthProvider";
import { useToast } from "@/components/Toast";
import { downloadExport } from "@/lib/download";
import { todayInTz } from "@/lib/time";

interface M { id: string; fullName: string; phone: string; memberNumber?: string }

export default function UnpaidPage() {
  const toast = useToast();
  const [month, setMonth] = useState(() => todayInTz().slice(0, 7));
  const [data, setData] = useState<{ members: M[]; activeCount: number; paidCount: number } | null>(null);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    setData(null);
    const r = await apiFetch(`/api/reports/unpaid?month=${month}`);
    if (r.ok) setData(await r.json()); else toast("error", "Could not load report");
  }, [month, toast]);
  useEffect(() => { if (month) load(); }, [load, month]);

  async function exportAs(format: "csv" | "xlsx" | "pdf") {
    setBusy(format);
    const err = await downloadExport({ type: "unpaid", format, month });
    setBusy(""); toast(err ? "error" : "success", err ?? "Export ready");
  }
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Members who have not paid</h1>
      <div className="card flex flex-wrap items-end gap-3">
        <div><label className="label" htmlFor="m">Month</label><input id="m" type="month" className="input" value={month} onChange={(e) => setMonth(e.target.value)} /></div>
        {(["csv", "xlsx", "pdf"] as const).map((f) => <button key={f} className="btn-secondary" disabled={!!busy || !data} onClick={() => exportAs(f)}>{busy === f ? "…" : f.toUpperCase()}</button>)}
      </div>
      {data === null ? <p className="text-slate-500">Loading…</p> : (
        <>
          <p className="text-sm text-slate-600">{data.members.length} of {data.activeCount} active members have not paid in {month}.</p>
          {data.members.length === 0 ? <p className="card">Everyone has paid. 🎉</p> : (
            <ul className="space-y-2">{data.members.map((m) => <li key={m.id} className="card"><p className="font-medium">{m.fullName}</p><p className="text-sm text-slate-600">{m.phone}{m.memberNumber ? ` · #${m.memberNumber}` : ""}</p></li>)}</ul>)}
        </>
      )}
    </div>
  );
}
