"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, Award, BarChart3, CandlestickChart, Check, ChevronRight, Copy, Home, Hourglass, Share2, Trophy, Wallet, XCircle } from "lucide-react";
import { LineChart } from "@/components/charts/line-chart";
import { Countdown, DaysGauge } from "@/components/challenge/gauges";
import { Badge, Button, Card, CardHeader, EmptyState, LinkButton, Progress, Skeleton } from "@/components/ui";
import { api, refresh, useChallenge } from "@/lib/hooks";
import { cn, signed, usd } from "@/lib/format";

export default function ChallengeAnalyticsPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error } = useChallenge(id);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (error) return <EmptyState title="Challenge not found" body={error.message} action={<LinkButton href="/challenges">Back to challenges</LinkButton>} />;
  if (!data) return <div className="space-y-4"><Skeleton className="h-16" /><Skeleton className="h-40" /><Skeleton className="h-96" /></div>;

  const { challenge: ch, equity, targets, verdict } = data;
  const p = ch.plan;
  const start = ch.phase_start_balance;
  const profit = equity - start;
  const dailyLoss = Math.max(0, ch.day_start_balance - equity);
  const drawdownUsed = Math.max(0, start - Math.min(equity, ch.low_equity));
  const failed = ch.status === "failed";
  const funded = ch.phase === 3;

  const today = new Date().toISOString().slice(0, 10);
  const series = new Map<string, number>();
  series.set(ch.phase_started_at.slice(0, 10), start);
  data.snapshots.forEach((s) => series.set(s.day, s.equity));
  if (!failed) series.set(today, equity);
  const points = [...series.entries()].sort().map(([time, value]) => ({ time, value }));
  const levels = [
    ...(targets.target ? [{ price: start + targets.target, color: "#2fe0a0", title: "Target" }] : []),
    { price: targets.minBalance, color: "#ff4d6d", title: "Min balance" },
  ];

  const overview: [string, number, number][] = [
    ["Net profit / loss", profit, (profit / start) * 100],
    ["Current equity", equity, ((equity - start) / start) * 100],
    ["Low equity", ch.low_equity, ((ch.low_equity - start) / start) * 100],
    ["Best day", ch.best_day, (ch.best_day / start) * 100],
    ["Worst day", ch.worst_day, (ch.worst_day / start) * 100],
  ];

  const share = async () => {
    const text = `I'm ${failed ? "trading" : profit >= 0 ? "up" : "down"} ${((profit / start) * 100).toFixed(2)}% on my ${p.name} challenge (${ch.public_id}) on Facet.`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        setMsg({ ok: true, text: "Copied your stats to the clipboard." });
      }
    } catch {}
  };

  const payout = async () => {
    setMsg(null);
    try {
      await api("POST", `/api/challenges/${ch.id}/payout`);
      setMsg({ ok: true, text: "Simulated payout recorded." });
      refresh(`/api/challenges`, "/api/payouts", "/api/accounts");
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };

  const rules: [string, boolean | null][] = [
    ...(funded ? [] : [[`Profit target ${targets.targetPct}%`, profit >= (targets.target ?? Infinity) ? true : null] as [string, boolean | null]]),
    [`Max daily loss ${p.max_daily_loss_pct}%`, failed && ch.fail_reason?.includes("Daily") ? false : true],
    [`Max drawdown ${p.max_drawdown_pct}%`, failed && ch.fail_reason?.includes("drawdown") ? false : true],
    ...(funded ? [] : [[`Min ${p.min_days} trading days`, ch.trading_days >= p.min_days ? true : null] as [string, boolean | null]]),
  ];

  return (
    <div className="fade-up space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex items-center gap-2 text-sm text-muted">
          <Link href="/overview" aria-label="Home"><Home size={16} /></Link><ChevronRight size={14} />
          <Link href="/challenges" className="hover:text-text">Challenges</Link><ChevronRight size={14} />
          <span className="text-text">{ch.public_id}</span>
        </nav>
        <span className="text-xs text-muted">Rules are checked live and every 20 seconds</span>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {[1, 2, 3].map((ph) => (
          <span key={ph} className="flex items-center gap-2">
            <span className={cn("flex items-center gap-2 rounded-full px-3 py-1.5", ch.phase === ph && !failed ? "glass-glow relative bg-blue/12" : ch.phase > ph ? "border border-up/30 text-up" : "border border-line text-muted")}>
              {ch.phase > ph ? <Check size={12} /> : ph === 3 ? <Trophy size={12} /> : <span className="grid size-4 place-items-center rounded-full bg-white/10 text-[9px]">{ph}</span>}
              {ph === 3 ? "Funded (sim)" : `Phase ${ph}`}
            </span>
            {ph < 3 && <ChevronRight size={14} className="text-dim" />}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="grid size-12 place-items-center rounded-full border border-line-strong bg-blue/15 text-blue-glow shadow-[0_0_30px_-6px_rgba(47,75,255,.7)]"><BarChart3 size={20} /></span>
          <h1 className="text-[28px] font-medium tracking-tight">Analytics</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {!failed && <LinkButton href="/terminal" variant="outline" size="sm"><CandlestickChart size={14} /> Trade this account</LinkButton>}
          <Button size="sm" onClick={share}><Share2 size={14} /> Share stats</Button>
        </div>
      </div>
      {msg && <p role="status" className={cn("rounded-xl px-4 py-3 text-sm", msg.ok ? "bg-up/10 text-up" : "bg-down/10 text-down")}>{msg.text}</p>}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr]">
        <Card>
          <p className="text-[11px] tracking-wider text-dim uppercase">Account</p>
          <div className="mt-1 flex items-center gap-2 text-[15px]">
            Challenge: <span className="font-medium">{ch.public_id}</span>
            <button onClick={() => { navigator.clipboard?.writeText(ch.public_id); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="text-dim hover:text-text" aria-label="Copy challenge ID">{copied ? <Check size={14} className="text-up" /> : <Copy size={14} />}</button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
            Status: <Badge tone={failed ? "down" : funded ? "up" : "violet"}>{failed ? "Failed" : funded ? "Funded (sim)" : "In progress"}</Badge>
            <span className="h-4 w-px bg-line" />
            Type: <Badge tone="warn">◆ {p.name} · {usd(p.size, 0)}</Badge>
          </div>
          <p className="mt-3 text-xs text-dim">Started {new Date(ch.started_at).toLocaleDateString()} · this phase since {new Date(ch.phase_started_at).toLocaleDateString()}</p>
        </Card>
        <Card glow className="overflow-hidden">
          <div className="spot-blue absolute inset-0" />
          <div className="relative">
            <span className="grid size-9 place-items-center rounded-full border border-line-strong text-blue-glow"><Trophy size={16} /></span>
            {funded ? (
              <>
                <p className="mt-4 text-lg font-medium">Simulated funded account</p>
                <p className="mt-1 text-xs text-blue-glow">No target: keep within the loss limits and record payouts.</p>
              </>
            ) : (
              <>
                <p className="mt-4 text-lg"><b className="font-medium">Phase {ch.phase}</b> <span className="text-muted">of 2</span></p>
                <p className="mt-1 text-xs text-blue-glow">{ch.phase === 1 ? `Pass to unlock Phase 2 · target ${p.phase2_target_pct}%` : "Pass to get certified and funded (sim)"}</p>
              </>
            )}
          </div>
        </Card>
        <Card>
          <p className="mb-3 text-sm font-medium">Rules</p>
          <ul className="space-y-2 text-xs">
            {rules.map(([t, ok]) => (
              <li key={t} className="flex items-center gap-2">
                <span className={cn("grid size-4 place-items-center rounded", ok === false ? "bg-down/20 text-down" : ok ? "bg-up/20 text-up" : "bg-white/10 text-dim")}>
                  {ok === false ? <XCircle size={11} /> : ok ? <Check size={11} /> : <Hourglass size={10} />}
                </span>
                {t}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {failed && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-down/30 bg-gradient-to-r from-down/15 to-transparent px-5 py-3.5">
          <span className="grid size-9 place-items-center rounded-full bg-down/15 text-down"><XCircle size={17} /></span>
          <div className="flex-1 text-sm">
            <p className="font-medium">Challenge ended</p>
            <p className="text-xs text-muted">{ch.fail_reason}. Every challenge teaches something. Review your trades below, then try again.</p>
          </div>
          <LinkButton href="/challenges" size="sm">Start a new challenge</LinkButton>
        </div>
      )}
      {!failed && verdict.result === "ok" && verdict.warn && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-warn/30 bg-gradient-to-r from-warn/15 to-transparent px-5 py-3.5">
          <span className="grid size-9 place-items-center rounded-full bg-warn/15 text-warn"><AlertTriangle size={17} /></span>
          <div className="flex-1 text-sm">
            <p className="font-medium">You&apos;re close to a loss limit</p>
            <p className="text-xs text-muted">Daily loss used: {verdict.dailyLossUsedPct.toFixed(0)}% · drawdown used: {verdict.drawdownUsedPct.toFixed(0)}%. Consider reducing size.</p>
          </div>
        </div>
      )}

      {funded && !failed && (
        <div>
          <h3 className="mb-3 text-[15px] font-medium">Payout <span className="text-xs font-normal text-dim">(simulated)</span></h3>
          <div className="glass glass-glow flex flex-wrap items-center gap-4 px-5 py-4">
            <span className="grid size-10 place-items-center rounded-xl bg-white/[0.05] text-blue-glow"><Wallet size={18} /></span>
            <p className="text-sm text-muted">{data.payout.eligible ? "You're eligible for a simulated payout" : data.payout.reasons[0]}</p>
            <p className="num text-3xl font-medium text-blue-glow">{usd(data.payout.amount)}</p>
            <span className="text-xs text-dim">80% of {usd(data.payout.profit)} · no real money</span>
            <Button variant="outline" size="sm" className="ml-auto" disabled={!data.payout.eligible} onClick={payout}>Request payout</Button>
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Total overview" />
            <div className="space-y-3">
              {overview.map(([k, v, pctv]) => (
                <div key={k} className="flex items-center justify-between text-sm">
                  <span className="text-xs text-muted">{k}</span>
                  <span className="flex items-center gap-2">
                    <span className="num">{usd(v)}</span>
                    <Badge tone={pctv >= 0 ? "up" : "down"} className="w-16 justify-center">{pctv >= 0 ? "↑" : "↓"} {Math.abs(pctv).toFixed(1)}%</Badge>
                  </span>
                </div>
              ))}
            </div>
          </Card>
          {!failed && <Card><Countdown /></Card>}
        </div>
        <Card>
          <CardHeader title="Stats overview" sub="Equity at each daily close, plus live equity today" />
          <LineChart lines={[{ name: "Equity", color: "#8b6cff", data: points }]} levels={levels} height={340} />
          <div className="mt-3 flex flex-wrap gap-5 text-xs text-muted">
            <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-down" />Minimum balance: {usd(targets.minBalance, 0)}</span>
            {targets.target && <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-up" />Profit target: {usd(start + targets.target, 0)}</span>}
            <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-violet" />Equity: {usd(equity, 0)}</span>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {!funded && targets.target && (
          <Card>
            <CardHeader title="Profit target" action={<Badge tone={profit >= targets.target ? "up" : "violet"}>{profit >= targets.target ? "Target met" : "In progress"}</Badge>} />
            <div className="flex items-end justify-between">
              <div><p className={cn("num text-2xl font-medium", profit < 0 && "text-down")}>{usd(profit, 0)}</p><p className="text-xs text-muted">Current result {((profit / start) * 100).toFixed(2)}%</p></div>
              <div className="text-right"><p className="num text-sm">{usd(targets.target, 0)}</p><p className="text-xs text-muted">Required</p></div>
            </div>
            <div className="mt-4"><Progress value={(profit / targets.target) * 100} tone="blue" striped /></div>
          </Card>
        )}
        <Card>
          <CardHeader title="Loss limits" action={<Badge tone={failed ? "down" : verdict.result === "ok" && verdict.warn ? "warn" : "up"}>{failed ? "Breached" : verdict.result === "ok" && verdict.warn ? "Caution" : "Safe"}</Badge>} />
          <div className="mb-1.5 flex justify-between text-xs"><span className="text-muted">Daily loss today</span><span className="num">{usd(dailyLoss, 0)} / {usd(targets.dailyLimit, 0)}</span></div>
          <Progress value={(dailyLoss / targets.dailyLimit) * 100} tone="violet" striped />
          <div className="mt-4 mb-1.5 flex justify-between text-xs"><span className="text-muted">Max drawdown (from low)</span><span className="num">{usd(drawdownUsed, 0)} / {usd(targets.maxLoss, 0)}</span></div>
          <Progress value={(drawdownUsed / targets.maxLoss) * 100} tone="down" striped />
          <p className="mt-3 text-[11px] text-dim">Daily loss is measured from your equity at the last 4 PM ET close ({usd(ch.day_start_balance, 0)}).</p>
        </Card>
        {!funded ? (
          <Card>
            <CardHeader title="Trading days" action={<Badge tone={ch.trading_days >= p.min_days ? "up" : "violet"}>{ch.trading_days >= p.min_days ? "Done" : "In progress"}</Badge>} />
            <p className="text-xs text-muted">At least {p.min_days} trading days per phase. A day counts when you place a trade.</p>
            <div className="mt-2"><DaysGauge done={Math.min(ch.trading_days, p.min_days)} min={p.min_days} /></div>
          </Card>
        ) : (
          <Card>
            <CardHeader title="Payout history" />
            {data.payouts.length === 0 ? <p className="text-sm text-muted">No payouts recorded yet.</p> : data.payouts.map((po) => (
              <div key={po.id} className="flex justify-between border-b border-line py-2 text-sm"><span className="text-muted">{new Date(po.created_at).toLocaleDateString()}</span><span className="num">{usd(po.amount)}</span></div>
            ))}
          </Card>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="p-0">
          <div className="border-b border-line px-5 py-4"><h3 className="text-[15px] font-medium">Trade journal</h3><p className="text-xs text-muted">Last 50 fills on this challenge account</p></div>
          {data.fills.length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted">No trades yet. Open the terminal and pick this challenge&apos;s account.</p> : (
            <div className="max-h-80 overflow-auto">
              <table className="w-full text-[13px]">
                <thead><tr className="text-[11px] text-dim">{["Time", "Symbol", "Side", "Qty", "Price", "Realized"].map((h) => <th key={h} className="px-5 py-2 text-left font-normal">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-line">
                  {data.fills.map((f) => (
                    <tr key={f.id}>
                      <td className="num px-5 py-2 text-muted">{new Date(f.created_at).toLocaleString("en-US", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="px-5 font-medium">{f.symbol}</td>
                      <td className={cn("px-5 capitalize", f.side === "buy" ? "text-up" : "text-down")}>{f.side}</td>
                      <td className="num px-5">{f.qty}</td>
                      <td className="num px-5">{usd(f.price)}</td>
                      <td className={cn("num px-5", f.realized_pnl > 0 ? "text-up" : f.realized_pnl < 0 ? "text-down" : "text-muted")}>{f.side === "sell" ? signed(f.realized_pnl) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card>
          <CardHeader title="Certificates" icon={<Award size={16} />} />
          {data.certificates.length === 0 ? <p className="text-sm text-muted">Pass a phase to earn your first certificate.</p> : data.certificates.map((c) => (
            <Link key={c.id} href="/certificates" className="mb-2 block rounded-xl border border-line bg-white/[0.02] px-4 py-3 hover:border-line-strong">
              <p className="accent text-lg">{c.title}</p>
              <p className="text-xs text-muted">{c.detail} · {new Date(c.issued_at).toLocaleDateString()} · {c.code}</p>
            </Link>
          ))}
        </Card>
      </div>
    </div>
  );
}
