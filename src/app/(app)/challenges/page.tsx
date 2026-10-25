"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Flag, Loader2, Lock, Rocket } from "lucide-react";
import { Badge, Button, Card, CardHeader, EmptyState, ErrorNote, LinkButton, PageHeader, Progress, Skeleton, statusTone } from "@/components/ui";
import { api, refresh, useChallenges, type ChallengeSummary } from "@/lib/hooks";
import { cn, signed, usd } from "@/lib/format";

const statusLabel = (c: ChallengeSummary) => (c.status === "failed" ? "Failed" : c.phase === 3 ? "Funded (sim)" : `Phase ${c.phase}`);

export default function ChallengesPage() {
  const router = useRouter();
  const { data, error, isLoading } = useChallenges();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const start = async (planId: string) => {
    setBusy(planId);
    setErr(null);
    try {
      const r = await api<{ challenge: { id: string } }>("POST", "/api/challenges", { planId });
      refresh("/api/challenges", "/api/accounts", "/api/me");
      router.push(`/challenges/${r.challenge.id}`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const active = data?.challenges.filter((c) => c.status === "active") ?? [];
  const past = data?.challenges.filter((c) => c.status !== "active") ?? [];

  return (
    <div className="fade-up space-y-8">
      <PageHeader icon={<Flag size={20} />} title="Trading" accent="challenges" sub="Prove your edge on a simulated account. Hit the target without breaking the risk rules." />
      <ErrorNote error={error} />

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ["1", "Pick a challenge", "Choose an account size and rule set."],
          ["2", "Phase 1", "Reach the profit target within the loss limits and minimum trading days."],
          ["3", "Phase 2", "Repeat with half the target to confirm consistency."],
          ["4", "Get certified", "Earn a certificate and a simulated funded account."],
        ].map(([n, t, d]) => (
          <Card key={n} className="py-4">
            <span className="accent text-3xl text-blue-glow">{n}</span>
            <h4 className="mt-1 text-sm font-medium">{t}</h4>
            <p className="mt-1 text-xs text-muted">{d}</p>
          </Card>
        ))}
      </div>

      <section>
        <h2 className="mb-4 text-lg font-medium">Start a <span className="accent text-blue-glow">new challenge</span></h2>
        {err && <p role="alert" className="mb-4 rounded-xl border border-down/30 bg-down/10 px-4 py-3 text-sm text-down">{err} {err.includes("Pro") && <Link href="/billing" className="underline">Go to Billing →</Link>}</p>}
        <div className="grid gap-5 lg:grid-cols-3">
          {isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-96" />)}
          {data?.plans.map((p, i) => {
            const locked = p.pro_only && !data.pro;
            return (
              <Card key={p.id} glow={i === 1} className={cn("flex flex-col", i === 1 && "bg-blue/[0.06]")}>
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">{p.name}</h3>
                  {p.pro_only ? <Badge tone="violet">{locked && <Lock size={10} />} Pro</Badge> : <Badge tone="up">Free</Badge>}
                </div>
                <p className="num mt-4 text-4xl font-medium tracking-tight">{usd(p.size, 0)}</p>
                <p className="text-xs text-muted">Simulated starting balance</p>
                <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                  {[
                    ["Profit target (Phase 1)", `${p.profit_target_pct}%`],
                    ["Profit target (Phase 2)", `${p.phase2_target_pct}%`],
                    ["Max daily loss", `${p.max_daily_loss_pct}%`],
                    ["Max overall drawdown", `${p.max_drawdown_pct}%`],
                    ["Min trading days", `${p.min_days}`],
                    ["Time limit", "None"],
                  ].map(([k, v]) => (
                    <li key={k} className="flex items-center justify-between border-b border-line pb-2.5">
                      <span className="flex items-center gap-2 text-muted"><Check size={14} className="text-blue-glow" />{k}</span>
                      <span className="num">{v}</span>
                    </li>
                  ))}
                </ul>
                {locked ? (
                  <LinkButton href="/billing" variant="outline" className="mt-5 w-full"><Lock size={14} /> Unlock with Pro</LinkButton>
                ) : (
                  <Button onClick={() => start(p.id)} disabled={busy !== null} variant={i === 1 ? "primary" : "outline"} className="mt-5 w-full">
                    {busy === p.id ? <Loader2 size={15} className="animate-spin" /> : <Rocket size={15} />} Start {p.name}
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title={`Active challenges (${active.length})`} />
          {data && active.length === 0 && <EmptyState title="No active challenges" body="Pick a plan above to start." />}
          <div className="space-y-3">
            {active.map((c) => {
              const targetPct = c.phase === 1 ? c.plan.profit_target_pct : c.plan.phase2_target_pct;
              const profit = c.equity - c.phase_start_balance;
              return (
                <Link key={c.id} href={`/challenges/${c.id}`} className="block rounded-xl border border-line bg-white/[0.02] p-4 hover:border-line-strong">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span>Challenge ID <b className="font-medium">{c.public_id}</b></span>
                    <Badge tone="violet">{statusLabel(c)}</Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                    <div><p className="text-muted">Equity</p><p className="num mt-0.5 text-sm">{usd(c.equity)}</p></div>
                    <div><p className="text-muted">Profit</p><p className={cn("num mt-0.5 text-sm", profit >= 0 ? "text-up" : "text-down")}>{signed(profit)}</p></div>
                    <div><p className="text-muted">Days</p><p className="num mt-0.5 text-sm">{c.trading_days}/{c.plan.min_days}</p></div>
                  </div>
                  {c.phase < 3 && <div className="mt-4"><Progress value={(profit / (c.phase_start_balance * (targetPct / 100))) * 100} tone="up" striped /></div>}
                </Link>
              );
            })}
          </div>
        </Card>
        <Card>
          <CardHeader title="History" />
          {data && past.length === 0 && <p className="py-6 text-center text-sm text-muted">Finished challenges show up here.</p>}
          <div className="divide-y divide-line">
            {past.map((c) => (
              <Link key={c.id} href={`/challenges/${c.id}`} className="flex items-center justify-between py-3 text-sm hover:opacity-90">
                <div>
                  <p className="font-medium">{c.public_id}</p>
                  <p className="text-xs text-muted">{c.plan.name} · {usd(c.plan.size, 0)} · ended {c.ended_at ? new Date(c.ended_at).toLocaleDateString() : ""}</p>
                  {c.fail_reason && <p className="text-xs text-down">{c.fail_reason}</p>}
                </div>
                <div className="text-right">
                  <Badge tone={statusTone(c.status === "failed" ? "Failed" : "Passed")}>{c.status === "failed" ? "Failed" : "Passed"}</Badge>
                  <p className={cn("num mt-1 text-xs", c.equity - c.phase_start_balance >= 0 ? "text-up" : "text-down")}>{signed(c.equity - c.phase_start_balance)}</p>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
