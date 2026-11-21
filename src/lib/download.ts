import { apiFetch } from "@/lib/auth/AuthProvider";

/** Authenticated download: the token goes in a header, so we fetch then save the blob. */
export async function downloadExport(params: Record<string, string>): Promise<string | null> {
  const r = await apiFetch(`/api/exports?${new URLSearchParams(params)}`);
  if (!r.ok) { const j = await r.json().catch(() => ({})); return j.issues?.[0]?.message ?? j.error ?? "Export failed"; }
  const name = /filename="([^"]+)"/.exec(r.headers.get("Content-Disposition") ?? "")?.[1] ?? `export.${params.format}`;
  const url = URL.createObjectURL(await r.blob());
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return null;
}
