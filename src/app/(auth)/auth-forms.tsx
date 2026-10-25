"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button, Field, inputCls } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Divider, GoogleButton } from "./google-button";

const nextParam = () => {
  const n = new URLSearchParams(window.location.search).get("next") ?? "/overview";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/overview";
};

const friendly = (m: string) => (m === "Failed to fetch" || m.includes("NetworkError") ? "Can't reach the server right now. Check your connection and try again." : m);

function ErrorNote({ msg }: { msg: string | null }) {
  msg = msg && friendly(msg);
  return msg ? <p role="alert" className="rounded-lg border border-down/30 bg-down/10 px-3 py-2 text-xs text-down">{msg}</p> : null;
}

function useGoogle() {
  return async () => {
    await supabaseBrowser().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextParam())}` },
    });
  };
}

export function LoginForm() {
  const router = useRouter();
  const google = useGoogle();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setErr(null);
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email: String(f.get("email")), password: String(f.get("password")) });
    setBusy(false);
    if (error) return setErr(error.message === "Invalid login credentials" ? "That email and password don't match." : error.message);
    router.replace(nextParam());
  };

  return (
    <>
      <div className="mt-7"><GoogleButton onClick={google} /></div>
      <Divider />
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email"><input name="email" type="email" required autoComplete="email" placeholder="you@example.com" className={inputCls} /></Field>
        <Field label="Password"><input name="password" type="password" required autoComplete="current-password" placeholder="••••••••" className={inputCls} /></Field>
        <div className="flex items-center justify-end text-xs">
          <Link href="/forgot-password" className="text-blue-glow hover:underline">Forgot password?</Link>
        </div>
        <ErrorNote msg={err} />
        <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />} Sign in</Button>
      </form>
    </>
  );
}

export function SignupForm() {
  const router = useRouter();
  const google = useGoogle();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const password = String(f.get("password"));
    if (password.length < 8) return setErr("Use at least 8 characters for your password.");
    if (!f.get("agree")) return setErr("Please confirm you understand Facet is a simulator.");
    setBusy(true);
    setErr(null);
    const email = String(f.get("email"));
    const { data, error } = await supabaseBrowser().auth.signUp({
      email, password,
      options: { data: { full_name: String(f.get("name")).trim() }, emailRedirectTo: `${window.location.origin}/auth/callback?next=/overview` },
    });
    setBusy(false);
    if (error) return setErr(error.message);
    if (data.session) router.replace("/overview");
    else setSent(email);
  };

  if (sent) {
    return (
      <div className="glass mt-7 p-5 text-sm">
        <p className="font-medium">Check your inbox</p>
        <p className="mt-1 text-muted">We sent a confirmation link to <span className="text-text">{sent}</span>. Click it to activate your account.</p>
      </div>
    );
  }

  return (
    <>
      <div className="mt-7"><GoogleButton label="Sign up with Google" onClick={google} /></div>
      <Divider />
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full name"><input name="name" required maxLength={80} autoComplete="name" placeholder="Your name" className={inputCls} /></Field>
        <Field label="Email"><input name="email" type="email" required autoComplete="email" placeholder="you@example.com" className={inputCls} /></Field>
        <Field label="Password" hint="At least 8 characters"><input name="password" type="password" required autoComplete="new-password" placeholder="••••••••" className={inputCls} /></Field>
        <label className="flex items-start gap-2 text-xs text-muted"><input name="agree" type="checkbox" className="mt-0.5 accent-[#4d6bff]" /> I understand Facet is a simulator and agree to the Terms and Privacy Policy.</label>
        <ErrorNote msg={err} />
        <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />} Create account</Button>
      </form>
    </>
  );
}

export function ForgotForm() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabaseBrowser().auth.resetPasswordForEmail(String(new FormData(e.currentTarget).get("email")), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setBusy(false);
    if (error) setErr(error.message);
    else setDone(true);
  };
  if (done) return <p className="glass mt-7 p-5 text-sm text-muted">If an account exists for that email, a reset link is on its way.</p>;
  return (
    <form onSubmit={submit} className="mt-7 space-y-4">
      <Field label="Email"><input name="email" type="email" required placeholder="you@example.com" className={inputCls} /></Field>
      <ErrorNote msg={err} />
      <Button type="submit" size="lg" className="w-full" disabled={busy}>Send reset link</Button>
    </form>
  );
}

export function ResetForm() {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password"));
    if (password.length < 8) return setErr("Use at least 8 characters.");
    setBusy(true);
    const { error } = await supabaseBrowser().auth.updateUser({ password });
    setBusy(false);
    if (error) return setErr(error.message);
    router.replace("/overview");
  };
  return (
    <form onSubmit={submit} className="mt-7 space-y-4">
      <Field label="New password"><input name="password" type="password" required autoComplete="new-password" className={inputCls} /></Field>
      <ErrorNote msg={err} />
      <Button type="submit" size="lg" className="w-full" disabled={busy}>Save password</Button>
    </form>
  );
}
