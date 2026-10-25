"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Lock, Palette, User } from "lucide-react";
import { Button, Card, CardHeader, Field, PageHeader, Skeleton, inputCls } from "@/components/ui";
import { api, refresh, useMe, type Me } from "@/lib/hooks";
import { supabaseBrowser } from "@/lib/supabase/client";

type P = Me["profile"];

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between py-2.5 text-sm">
      <span className="text-muted">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span className="relative h-5 w-9 rounded-full bg-white/10 transition peer-checked:bg-blue peer-focus-visible:ring-2 peer-focus-visible:ring-blue/50 after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-4" />
    </label>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { data: me } = useMe();
  const [draft, setForm] = useState<P | null>(null);
  const form = draft ?? me?.profile ?? null;
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (patch: Partial<P>) => {
    setBusy(true);
    setMsg(null);
    try {
      await api("PATCH", "/api/me", patch);
      setMsg({ ok: true, text: "Saved." });
      refresh("/api/me");
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  const toggle = (k: keyof P) => (v: boolean) => {
    setForm({ ...form!, [k]: v });
    save({ [k]: v });
  };
  const resetPassword = async () => {
    if (!me) return;
    await supabaseBrowser().auth.resetPasswordForEmail(me.email, { redirectTo: `${window.location.origin}/auth/callback?next=/reset-password` });
    setMsg({ ok: true, text: `Password reset link sent to ${me.email}.` });
  };
  const signOutAll = async () => {
    await supabaseBrowser().auth.signOut({ scope: "global" });
    router.replace("/login");
    router.refresh();
  };
  const deleteAccount = async () => {
    if (!confirm("Delete your Facet account permanently? This removes all accounts, challenges and certificates. This cannot be undone.")) return;
    await api("DELETE", "/api/me");
    await supabaseBrowser().auth.signOut();
    router.replace("/");
    router.refresh();
  };

  if (!form || !me) return <div className="space-y-4"><Skeleton className="h-16" /><Skeleton className="h-96" /></div>;
  const initials = (form.full_name || me.email).split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="fade-up space-y-6">
      <PageHeader icon={<User size={20} />} title="Profile" accent="& settings" />
      {msg && <p role="status" className={msg.ok ? "rounded-xl bg-up/10 px-4 py-3 text-sm text-up" : "rounded-xl bg-down/10 px-4 py-3 text-sm text-down"}>{msg.text}</p>}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Personal details" icon={<User size={16} />} />
          <div className="mb-5 flex items-center gap-4">
            <span className="grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-blue-2 to-violet text-xl font-semibold">{initials}</span>
            <div><p className="font-medium">{form.full_name || "Unnamed trader"}</p><p className="text-xs text-muted">Member since {new Date(form.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</p></div>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); save({ full_name: form.full_name, handle: form.handle ?? "", country: form.country }); }} className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name"><input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} maxLength={80} className={inputCls} /></Field>
            <Field label="Public handle" hint="Shown on leaderboards"><input value={form.handle ?? ""} onChange={(e) => setForm({ ...form, handle: e.target.value })} placeholder="your_handle" maxLength={20} className={inputCls} /></Field>
            <Field label="Email"><input value={me.email} disabled className={inputCls + " text-muted"} /></Field>
            <Field label="Country"><input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} maxLength={60} placeholder="e.g. Pakistan" className={inputCls} /></Field>
            <div className="sm:col-span-2"><Button disabled={busy}>Save changes</Button></div>
          </form>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Notifications" icon={<Bell size={16} />} />
            <div className="divide-y divide-line">
              <Toggle label="Order fills (in-app)" checked={form.notify_fills} onChange={toggle("notify_fills")} />
              <Toggle label="Price alerts by email" checked={form.notify_alerts_email} onChange={toggle("notify_alerts_email")} />
              <Toggle label="Challenge rule warnings" checked={form.notify_rule_warnings} onChange={toggle("notify_rule_warnings")} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Privacy" icon={<Palette size={16} />} />
            <div className="divide-y divide-line"><Toggle label="Show me on public leaderboards" checked={form.public_profile} onChange={toggle("public_profile")} /></div>
          </Card>
          <Card>
            <CardHeader title="Security" icon={<Lock size={16} />} />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={resetPassword}>Send password reset email</Button>
              <Button variant="outline" size="sm" onClick={signOutAll}>Sign out of all devices</Button>
              <Button variant="ghost" size="sm" className="text-down" onClick={deleteAccount}>Delete account</Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
