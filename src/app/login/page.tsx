"use client";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const password = new FormData(form).get("password");
    setBusy(true); setError("");
    try {
      const result = await signIn("credentials", { password, redirect: false, callbackUrl: "/" });
      if (result?.ok) { router.push("/"); router.refresh(); }
      else setError("Sign-in failed. Check your password or try again in a minute.");
    } catch { setError("Sign-in unavailable. Please try again."); }
    finally { form.reset(); setBusy(false); }
  }
  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "var(--bg)" }}>
      <div className="hq-ambient" aria-hidden />
      <div className="relative z-10 panel hq-rise w-full max-w-sm p-8">
        <h1 className="text-center text-xl font-semibold">Hermy HQ</h1>
        <p className="eyebrow mt-2 text-center">Private owner access</p>
        <form onSubmit={submit} className="mt-7 flex flex-col gap-4">
          <label htmlFor="password">Owner password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required maxLength={1024} disabled={busy} className="rounded border p-3" />
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary w-full py-3">{busy ? "Signing in…" : "Sign in"}</button>
        </form>
      </div>
    </div>
  );
}
