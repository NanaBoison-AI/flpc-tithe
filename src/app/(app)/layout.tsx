"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, role, loading, logout, refreshRole } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!loading && !user) router.replace("/login"); }, [loading, user, router]);

  if (loading || !user) return <p className="p-6">Loading…</p>;
  if (!role) return (
    <main className="mx-auto max-w-sm p-6 space-y-4">
      <p>Your account has no role assigned yet. Ask an administrator to assign one, then tap &quot;Check again&quot;.</p>
      <div className="flex gap-2"><button className="btn" onClick={refreshRole}>Check again</button><button className="btn-secondary" onClick={logout}>Sign out</button></div>
    </main>
  );
  const links = [["/dashboard", "Dashboard"], ["/record", "Record"], ["/records", "Records"], ["/reports/unpaid", "Not paid"], ["/members", "Members"],
    ...(role === "admin" ? [["/admin/templates", "SMS templates"], ["/admin/sms-logs", "SMS logs"], ["/admin/audit", "Audit log"], ["/admin/settings", "Settings"]] : [])];
  return (
    <div className="mx-auto max-w-5xl">
      <header className="sticky top-0 z-10 border-b bg-white">
        <nav className="flex items-center gap-1 overflow-x-auto p-2">
          {links.map(([h, l]) => <Link key={h} href={h} className="whitespace-nowrap rounded-lg px-3 py-3 text-sm font-medium hover:bg-slate-100">{l}</Link>)}
          <button onClick={logout} className="ml-auto whitespace-nowrap rounded-lg px-3 py-3 text-sm text-slate-600">Sign out</button>
        </nav>
      </header>
      <main className="p-4">{children}</main>
    </div>
  );
}
