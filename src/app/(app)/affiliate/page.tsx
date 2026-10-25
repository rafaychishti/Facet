"use client";

import { useState } from "react";
import { BadgeDollarSign, Copy, Gift, Link2, Percent, ShoppingCart } from "lucide-react";
import { Badge, Button, Card, CardHeader, Field, Skeleton, inputCls } from "@/components/ui";
import { api, refresh, useAffiliate } from "@/lib/hooks";

const STEPS = [
  { icon: <Link2 size={20} />, title: "Copy and share your link", body: "Post it, send it directly or share it with your audience." },
  { icon: <ShoppingCart size={20} />, title: "Someone subscribes to Pro", body: "They sign up through your unique link or use your code." },
  { icon: <Percent size={20} />, title: "Earn 20% recurring", body: "For every Pro payment they make in their first 12 months." },
  { icon: <BadgeDollarSign size={20} />, title: "Get paid monthly", body: "Once you reach $50 in earnings, paid at the end of each month." },
];

export default function AffiliatePage() {
  const { data, isLoading } = useAffiliate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const app = data?.application;

  const apply = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setErr(null);
    try {
      await api("POST", "/api/affiliate", { website: f.get("website"), audience: f.get("audience") });
      refresh("/api/affiliate");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fade-up space-y-8">
      <Card glow className="overflow-hidden py-14 text-center">
        <div className="spot-blue absolute inset-0" />
        <div className="relative">
          <span className="mx-auto grid size-14 place-items-center rounded-full border border-line-strong bg-blue/15 text-blue-glow shadow-[0_0_40px_-6px_rgba(47,75,255,.8)]"><Gift size={22} /></span>
          <h1 className="mt-5 text-3xl font-medium tracking-tight sm:text-4xl">Welcome to <br />our <span className="accent text-blue-glow">Affiliate Program</span></h1>
          <p className="mt-3 text-sm text-muted">Earn on every Pro subscription you refer.</p>
        </div>
      </Card>

      <section>
        <h2 className="mb-4 text-[15px] font-medium">How it works</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {STEPS.map((s, i) => (
            <Card key={s.title} className="text-center">
              <p className="text-left text-sm text-muted">{i + 1}.</p>
              <span className="mx-auto mt-2 grid size-14 place-items-center rounded-2xl border border-line-strong bg-blue/10 text-blue-glow shadow-[0_0_30px_-8px_rgba(47,75,255,.8)]">{s.icon}</span>
              <h3 className="mt-5 text-sm font-medium">{s.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted">{s.body}</p>
            </Card>
          ))}
        </div>
      </section>

      <Card className="mx-auto max-w-2xl">
        {isLoading && <Skeleton className="h-40" />}
        {data && !app && (
          <>
            <CardHeader title="Apply to become an affiliate" sub="We review applications within a few days." />
            <form onSubmit={apply} className="space-y-4">
              <Field label="Website or social profile (optional)"><input name="website" maxLength={200} placeholder="https://" className={inputCls} /></Field>
              <Field label="Tell us about your audience"><textarea name="audience" required minLength={10} maxLength={1000} rows={4} placeholder="Who follows you and how you'd share Facet" className={inputCls + " h-auto py-3"} /></Field>
              {err && <p role="alert" className="text-sm text-down">{err}</p>}
              <Button disabled={busy}>Submit application</Button>
            </form>
          </>
        )}
        {app && (
          <>
            <CardHeader title="Your application" action={<Badge tone={app.status === "approved" ? "up" : app.status === "rejected" ? "down" : "warn"}>{app.status}</Badge>} />
            {app.status === "approved" && app.ref_code ? (
              <div className="flex items-center gap-2 rounded-xl border border-dashed border-line-strong px-3 py-3 font-mono text-sm">
                <span className="flex-1 truncate">{`${typeof window !== "undefined" ? window.location.origin : ""}/?ref=${app.ref_code}`}</span>
                <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/?ref=${app.ref_code}`)} aria-label="Copy link" className="text-muted hover:text-text"><Copy size={15} /></button>
              </div>
            ) : (
              <p className="text-sm text-muted">Submitted {new Date(app.created_at).toLocaleDateString()}. We&apos;ll notify you here once it&apos;s reviewed.</p>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
