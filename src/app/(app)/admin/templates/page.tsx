"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, useAuth } from "@/lib/auth/AuthProvider";
import { useToast } from "@/components/Toast";
import { PLACEHOLDERS, findUnknownPlaceholders, renderTemplate, smsStats } from "@/lib/sms/template";
import { dateInTz } from "@/lib/time";

interface Data { defaultTemplate: string; churchName: string; currency: string; templates: { month: string; body: string; updatedAt?: string }[] }

export default function TemplatesPage() {
  const { role } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<Data | null>(null);
  const [target, setTarget] = useState<string>(dateInTz(new Date()).slice(0, 7)); // YYYY-MM or "default"
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await apiFetch("/api/templates");
    if (r.ok) setData(await r.json()); else toast("error", "Could not load templates");
  }, [toast]);
  useEffect(() => { if (role === "admin") load(); }, [load, role]);

  // Load the text for whatever is selected.
  useEffect(() => {
    if (!data) return;
    setBody(target === "default" ? data.defaultTemplate : data.templates.find((t) => t.month === target)?.body ?? data.defaultTemplate);
  }, [target, data]);

  const unknown = useMemo(() => findUnknownPlaceholders(body), [body]);
  const preview = useMemo(() => renderTemplate(body, { fullName: "Ama Mensah", amount: 20000, totalThisMonth: 80000, currency: data?.currency ?? "GHS", paymentDate: target === "default" ? dateInTz(new Date()) : `${target}-15`, churchName: data?.churchName ?? "Church" }), [body, data, target]);
  const stats = smsStats(preview);

  if (role !== "admin") return <p className="card">Only administrators can manage SMS templates.</p>;

  async function save() {
    setBusy(true);
    const payload = target === "default" ? { kind: "default", body } : { kind: "month", month: target, body };
    const r = await apiFetch("/api/templates", { method: "PUT", body: JSON.stringify(payload) });
    setBusy(false);
    if (r.ok) { toast("success", "Template saved"); load(); } else { const j = await r.json().catch(() => ({})); toast("error", j.issues?.[0]?.message ?? j.error ?? "Could not save"); }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">SMS templates</h1>
      <div className="card space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="m">Month</label><input id="m" type="month" className="input" value={target === "default" ? "" : target} onChange={(e) => e.target.value && setTarget(e.target.value)} /></div>
          <div className="flex items-end"><button className={target === "default" ? "btn w-full" : "btn-secondary w-full"} onClick={() => setTarget("default")}>Edit default template</button></div>
        </div>
        <p className="text-sm text-slate-600">{target === "default" ? "Used when a month has no template of its own." : `Applies to tithes paid in ${target}. If you don't save one, the default is used.`}</p>
        <div><label className="label" htmlFor="b">Message</label><textarea id="b" rows={5} className="input py-2" value={body} onChange={(e) => setBody(e.target.value)} /></div>
        <div className="flex flex-wrap gap-1">{PLACEHOLDERS.map((p) => <button key={p} type="button" className="rounded-full border px-3 py-2 text-xs" onClick={() => setBody((b) => `${b}{${p}}`)}>{`{${p}}`}</button>)}</div>
        {unknown.length > 0 && <p role="alert" className="text-sm text-red-700">Unknown placeholder: {unknown.map((u) => `{${u}}`).join(", ")}</p>}
        <div className="rounded-lg bg-slate-100 p-3"><p className="mb-1 text-xs font-semibold uppercase text-slate-500">Preview (sample data)</p><p className="whitespace-pre-wrap">{preview}</p></div>
        <p className={`text-sm ${stats.overOne ? "text-amber-800" : "text-slate-600"}`}>{stats.length} characters · {stats.segments} SMS {stats.segments === 1 ? "segment" : "segments"} · {stats.encoding}{stats.overOne && " — over one segment, each message will cost more"}{stats.encoding === "Unicode" && " (special characters reduce the limit to 70 per segment)"}</p>
        <button className="btn w-full" disabled={busy || unknown.length > 0 || !body.trim()} onClick={save}>{busy ? "Saving…" : "Save template"}</button>
      </div>
      {data && data.templates.length > 0 && (
        <div className="card"><h2 className="mb-2 font-semibold">Saved monthly templates</h2>
          <ul className="divide-y">{data.templates.map((t) => <li key={t.month}><button className="min-h-12 w-full text-left" onClick={() => setTarget(t.month)}><span className="font-medium">{t.month}</span> <span className="text-sm text-slate-600">{t.body.slice(0, 70)}…</span></button></li>)}</ul></div>
      )}
    </div>
  );
}
