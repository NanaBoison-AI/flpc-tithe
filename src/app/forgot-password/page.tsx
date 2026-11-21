"use client";
import { useState } from "react";
import Link from "next/link";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try { await sendPasswordResetEmail(auth, email.trim()); } catch { /* never reveal whether the account exists */ }
    setDone(true); setBusy(false);
  }
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-4">
      <h1 className="text-2xl font-bold">Reset password</h1>
      <form onSubmit={submit} className="card space-y-4">
        {done ? <p>If that email has an account, a reset link has been sent.</p> : (<>
          <div><label className="label" htmlFor="email">Email</label>
            <input id="email" className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <button className="btn w-full" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button></>)}
        <Link href="/login" className="block text-center text-sm text-indigo-700 underline">Back to sign in</Link>
      </form>
    </main>
  );
}
