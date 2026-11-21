"use client";
import { useAuth } from "@/lib/auth/AuthProvider";
export default function Dashboard() {
  const { user, role } = useAuth();
  return <div className="card"><h1 className="text-xl font-bold">Dashboard</h1><p className="text-sm text-slate-600">Signed in as {user?.email} ({role}). Stats arrive in a later stage.</p></div>;
}
