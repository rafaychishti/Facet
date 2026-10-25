"use client";

import { useEffect, useState } from "react";
import { Check, CreditCard, Loader2, Sparkles } from "lucide-react";
import { Badge, Button, Card, CardHeader, Kv, PageHeader, Skeleton } from "@/components/ui";
import { PLANS } from "@/components/pricing-plans";
import { api, refresh, useMe, useSearchParam } from "@/lib/hooks";
import { cn } from "@/lib/format";

const STATUS: Record<string, string> = { trialing: "Trial", active: "Active", past_due: "Payment due", canceled: "Cancelled", none: "Free", incomplete: "Incomplete", unpaid: "Unpaid", paused: "Paused" };

export default function BillingPage() {
  const { data: me } = useMe();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const checkout = useSearchParam("checkout");
  const banner = checkout === "success" ? "Thanks! Your Pro trial is being activated. It can take a few seconds to appear." : checkout === "cancelled" ? "Checkout cancelled. You haven't been charged." : null;
  const sub = me?.subscription;
  const pro = me?.plan === "pro";

  useEffect(() => {
    if (checkout !== "success") return;
    // the webhook may land a moment after the redirect: poll briefly
    const t = [1500, 4000, 8000].map((ms) => setTimeout(() => refresh("/api/me"), ms));
    return () => t.forEach(clearTimeout);
  }, [checkout]);

  const go = async (path: string, body?: unknown) => {
    setBusy(path);
    setErr(null);
    try {
      const r = await api<{ url: string }>("POST", path, body ?? {});
      window.location.href = r.url;
    } catch (e) {
      setErr((e as Error).message);
      setBusy(null);
    }
  };

  return (
    <div className="fade-up space-y-8">
      <PageHeader icon={<CreditCard size={20} />} title="Billing" accent="& plan" sub="Secure payments by Stripe. You can cancel any time." />
      {banner && <p role="status" className="rounded-xl border border-blue/30 bg-blue/10 px-4 py-3 text-sm text-blue-glow">{banner}</p>}
      {err && <p role="alert" className="rounded-xl border border-down/30 bg-down/10 px-4 py-3 text-sm text-down">{err}</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card glow>
          <CardHeader title="Current plan" action={sub && <Badge tone={pro ? "violet" : "neutral"}>{STATUS[sub.status] ?? sub.status}</Badge>} />
          {!me ? <Skeleton className="h-32" /> : (
            <>
              <p className="text-3xl font-medium">{pro ? "Pro" : "Free"}</p>
              <div className="mt-3 divide-y divide-line">
                {sub?.status === "trialing" && sub.trial_end && <Kv k="Trial ends" v={new Date(sub.trial_end).toLocaleDateString()} />}
                {sub?.current_period_end && <Kv k={sub.cancel_at_period_end ? "Pro ends" : "Renews"} v={new Date(sub.current_period_end).toLocaleDateString()} />}
                {sub?.interval && <Kv k="Billing" v={sub.interval === "year" ? "Yearly" : "Monthly"} />}
                {sub?.status === "past_due" && <Kv k="Action needed" v={<span className="text-warn">Update your card</span>} />}
              </div>
              {(pro || sub?.status === "past_due" || sub?.status === "canceled") && (
                <Button className="mt-5" onClick={() => go("/api/billing/portal")} disabled={busy !== null}>
                  {busy === "/api/billing/portal" && <Loader2 size={15} className="animate-spin" />} Manage subscription & invoices
                </Button>
              )}
            </>
          )}
        </Card>

        <div className="grid gap-5 md:grid-cols-2">
          {PLANS.map((p) => {
            const isPro = p.id === "pro";
            const current = isPro ? pro : !pro;
            return (
              <Card key={p.id} glow={isPro} className={cn("flex flex-col", isPro && "bg-blue/[0.07]")}>
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">{p.name}</h3>
                  {current ? <Badge tone="up">Current</Badge> : isPro && <Badge tone="blue"><Sparkles size={11} /> 14-day trial</Badge>}
                </div>
                <p className="mt-3 flex items-baseline gap-2"><span className="num text-4xl font-medium">{p.price}</span><span className="text-sm text-muted">{p.period}</span></p>
                <ul className="mt-4 flex-1 space-y-2 text-sm">
                  {p.features.map((f) => <li key={f} className="flex gap-2"><Check size={15} className={isPro ? "text-blue-glow" : "text-muted"} />{f}</li>)}
                </ul>
                {isPro && !pro && (
                  <div className="mt-5 grid gap-2">
                    <Button onClick={() => go("/api/billing/checkout", { interval: "month" })} disabled={busy !== null}>
                      {busy === "/api/billing/checkout" && <Loader2 size={15} className="animate-spin" />} Start free trial · $20/mo
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => go("/api/billing/checkout", { interval: "year" })} disabled={busy !== null}>or $192/year (save 20%)</Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
      <p className="text-center text-xs text-dim">Card required for the trial. You won&apos;t be charged if you cancel before it ends. Coupon codes can be entered at checkout.</p>
    </div>
  );
}
