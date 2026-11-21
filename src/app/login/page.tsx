"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [fails, setFails] = useState(0);
  const [lockUntil, setLockUntil] = useState(0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (Date.now() < lockUntil) { setError("Too many attempts. Please wait a minute."); return; }
    setBusy(true); setError("");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.replace("/dashboard");
    } catch {
      const n = fails + 1; setFails(n);
      if (n >= 5) { setLockUntil(Date.now() + 60_000); setFails(0); }
      setError("Incorrect email or password.");
    } finally { setBusy(false); }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-4">
      <h1 className="text-2xl font-bold">Tithe Manager</h1>
      <form onSubmit={submit} className="card space-y-4">
        <div><label className="label" htmlFor="email">Email</label>
          <input id="email" className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div><label className="label" htmlFor="pw">Password</label>
          <input id="pw" className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button className="btn w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        <Link href="/forgot-password" className="block text-center text-sm text-indigo-700 underline">Forgot password?</Link>
      </form>
    </main>
  );
}
