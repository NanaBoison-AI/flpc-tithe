"use client";
import { useState } from "react";
import Link from "next/link";
import { apiFetch, useAuth } from "@/lib/auth/AuthProvider";
import { useToast } from "@/components/Toast";

interface Row { line: number; fullName: string; phone?: string; memberNumber?: string; errors: string[] }
interface Result { committed: boolean; total: number; validCount: number; invalidCount: number; preview: Row[]; errors: Row[] }

export default function ImportPage() {
  const { role } = useAuth();
  const toast = useToast();
  const [csv, setCsv] = useState("");
  const [res, setRes] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  if (role !== "admin") return <p className="card">Only administrators can import members.</p>;

  async function run(commit: boolean) {
    setBusy(true);
    const r = await apiFetch("/api/members/import", { method: "POST", body: JSON.stringify({ csv, commit }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { toast("error", j.error ?? "Import failed"); return; }
    setRes(j);
    if (commit) toast("success", `${j.validCount} members imported`);
  }
  function errorCsv() {
    if (!res) return;
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const text = ["line,name,error", ...res.errors.map((e) => [e.line, esc(e.fullName), esc(e.errors.join("; "))].join(","))].join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" })); a.download = "import-errors.csv"; a.click();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2"><h1 className="mr-auto text-xl font-bold">Import members</h1><Link href="/members" className="btn-secondary">Back</Link></div>
      <div className="card space-y-3">
        <p className="text-sm text-slate-600">CSV with columns <b>name</b>, <b>phone</b> and optional <b>member number</b>. Max 2000 rows.</p>
        <input type="file" accept=".csv,text/csv" className="input py-2" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setCsv(await f.text()); setRes(null); } }} />
        <div className="flex gap-2">
          <button className="btn" disabled={!csv || busy} onClick={() => run(false)}>Preview</button>
          {res && !res.committed && res.validCount > 0 && <button className="btn" disabled={busy} onClick={() => run(true)}>Import {res.validCount} valid rows</button>}
        </div>
      </div>
      {res && (
        <div className="card space-y-3">
          <p><b>{res.validCount}</b> valid · <b className={res.invalidCount ? "text-red-700" : ""}>{res.invalidCount}</b> with errors (of {res.total}){res.committed && " — imported. Rows with errors were skipped."}</p>
          {res.invalidCount > 0 && <button className="btn-secondary" onClick={errorCsv}>Download error report</button>}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b"><th className="p-2">Line</th><th className="p-2">Name</th><th className="p-2">Phone</th><th className="p-2">No.</th><th className="p-2">Result</th></tr></thead>
              <tbody>{res.preview.map((r) => (
                <tr key={r.line} className={`border-b ${r.errors.length ? "bg-red-50" : ""}`}><td className="p-2">{r.line}</td><td className="p-2">{r.fullName}</td><td className="p-2">{r.phone ?? "—"}</td><td className="p-2">{r.memberNumber ?? ""}</td><td className="p-2">{r.errors.length ? r.errors.join("; ") : "OK"}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
