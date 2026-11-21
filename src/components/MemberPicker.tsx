"use client";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/auth/AuthProvider";

export interface PickedMember { id: string; fullName: string; phone: string; memberNumber?: string }

export function MemberPicker({ value, onChange }: { value: PickedMember | null; onChange: (m: PickedMember | null) => void }) {
  const [q, setQ] = useState("");
  const [opts, setOpts] = useState<PickedMember[]>([]);
  const [open, setOpen] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    if (!q.trim() || value) { setOpts([]); return; }
    const n = ++seq.current;
    const t = setTimeout(async () => {
      const r = await apiFetch(`/api/members?${new URLSearchParams({ q, limit: "8" })}`);
      if (r.ok && n === seq.current) { setOpts((await r.json()).members); setOpen(true); }
    }, 200);
    return () => clearTimeout(t);
  }, [q, value]);

  if (value) return (
    <div className="flex min-h-12 items-center justify-between rounded-lg border border-emerald-300 bg-emerald-50 px-3">
      <span className="min-w-0 truncate font-medium">{value.fullName} <span className="text-sm font-normal text-slate-600">{value.phone}</span></span>
      <button type="button" className="ml-2 min-h-12 px-2 text-sm text-slate-700 underline" onClick={() => { onChange(null); setQ(""); }}>Change</button>
    </div>
  );
  return (
    <div className="relative">
      <input className="input" placeholder="Search member by name, phone or number" value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setOpen(true)} role="combobox" aria-controls="member-options" aria-expanded={open} aria-label="Member" autoComplete="off" />
      {open && q.trim() && (
        <ul id="member-options" className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border bg-white shadow-lg" role="listbox">
          {opts.length === 0 ? <li className="p-3 text-sm text-slate-500">No matching member</li> : opts.map((m) => (
            <li key={m.id}><button type="button" className="block min-h-12 w-full px-3 py-2 text-left hover:bg-slate-100" onClick={() => { onChange(m); setOpen(false); }}>
              <span className="font-medium">{m.fullName}</span> <span className="text-sm text-slate-600">{m.phone}{m.memberNumber ? ` · #${m.memberNumber}` : ""}</span>
            </button></li>
          ))}
        </ul>
      )}
    </div>
  );
}
