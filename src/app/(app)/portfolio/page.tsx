"use client";

import { useState } from "react";
import { Briefcase, RotateCcw } from "lucide-react";
import { AccountSwitcher } from "@/components/account-switcher";
import { LineChart } from "@/components/charts/line-chart";
import { PositionsTabs } from "@/components/positions-table";
import { Button, Card, CardHeader, Kv, PageHeader, Skeleton } from "@/components/ui";
import { api, refresh, useAccount, useActiveAccount } from "@/lib/hooks";
import { cn, pct, signed, usd } from "@/lib/format";

const COLORS = ["#4d6bff", "#8b6cff", "#2fe0a0", "#38bdf8", "#ffb547", "#ff4d6d", "#e9ecff", "#94a3b8"];

function Donut({ parts }: { parts: { label: string; value: number }[] }) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  const r = 42, c = 2 * Math.PI * r;
  const offsets = parts.reduce<number[]>((o, _p, i) => [...o, i === 0 ? 0 : o[i - 1] + (parts[i - 1].value / total) * c], []);
  return (
    <svg viewBox="0 0 100 100" className="size-44 -rotate-90" role="img" aria-label="Allocation chart">
      <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,.05)" strokeWidth="10" />
      {parts.map((p, i) => {
        const len = (p.value / total) * c;
        return <circle key={p.label} cx="50" cy="50" r={r} fill="none" stroke={COLORS[i % COLORS.length]} strokeWidth="10" strokeDasharray={`${Math.max(0, len - 1)} ${c - len + 1}`} strokeDashoffset={-offsets[i]} />;
      })}
    </svg>
  );
}

const fmt = (n: number | null, f: (x: number) => string) => (n === null || !Number.isFinite(n) ? "—" : f(n));

export default function PortfolioPage() {
  const { accounts, account, choose } = useActiveAccount();
  const { data } = useAccount(account?.id);
  const [resetting, setResetting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const a = data?.account;
  const parts = data ? [...data.holdings.map((h) => ({ label: h.symbol, value: Math.max(0, h.value) })), { label: "Cash", value: data.account.cash }] : [];
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;

  // one point per day: the start, every daily close, and today's live value
  const byDay = new Map<string, number>();
  if (data) {
    const first = data.snapshots[0]?.day ?? new Date().toISOString().slice(0, 10);
    const start = new Date(Date.parse(first) - 86400000).toISOString().slice(0, 10);
    byDay.set(start, data.account.starting_balance);
    data.snapshots.forEach((s) => byDay.set(s.day, s.equity));
    byDay.set(new Date().toISOString().slice(0, 10), data.account.equity);
  }
  const points = [...byDay.entries()].sort().map(([time, value]) => ({ time, value }));

  const reset = async () => {
    if (!account || !confirm("Reset this paper account to its starting balance? Positions, orders and history will be cleared.")) return;
    setResetting(true);
    setErr(null);
    try {
      await api("POST", `/api/accounts/${account.id}/reset`);
      refresh("/api/accounts");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="fade-up space-y-6">
      <PageHeader
        icon={<Briefcase size={20} />} title="Paper" accent="portfolio" sub="Simulated accounts · no real money"
        actions={
          <>
            <AccountSwitcher accounts={accounts} value={account?.id} onChange={choose} />
            {account?.kind === "paper" && <Button variant="outline" onClick={reset} disabled={resetting}><RotateCcw size={15} /> Reset account</Button>}
          </>
        }
      />
      {err && <p className="rounded-xl border border-down/30 bg-down/10 px-4 py-3 text-sm text-down">{err}</p>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {a
          ? ([
              ["Total equity", usd(a.equity), null],
              ["All-time P&L", signed(a.pnl), a.pnl],
              ["Return", pct(a.pnlPct), a.pnlPct],
              ["Buying power", usd(a.cash), null],
            ] as [string, string, number | null][]).map(([k, v, tone]) => (
              <Card key={k} className="py-4">
                <p className="text-xs text-muted">{k}</p>
                <p className={cn("num mt-1 text-2xl font-medium", tone !== null && (tone >= 0 ? "text-up" : "text-down"))}>{v}</p>
              </Card>
            ))
          : Array.from({ length: 4 }).map((_, i) => <Card key={i} className="py-4"><Skeleton className="h-12" /></Card>)}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader title="Equity curve" sub="Daily close, plus the live value today" />
          {!data ? (
            <Skeleton className="h-[300px] w-full" />
          ) : (
            <LineChart lines={[{ name: "Equity", color: "#6f8bff", area: true, data: points }]} levels={a ? [{ price: a.starting_balance, color: "rgba(139,145,184,.6)", title: "Start" }] : []} height={300} />
          )}
        </Card>
        <Card>
          <CardHeader title="Allocation" />
          <div className="flex flex-col items-center gap-5">
            <Donut parts={parts} />
            <div className="w-full space-y-1.5">
              {parts.map((p, i) => (
                <div key={p.label} className="flex items-center gap-2 text-sm">
                  <span className="size-2.5 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="flex-1">{p.label}</span>
                  <span className="num text-muted">{((p.value / total) * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="glass overflow-hidden p-0"><PositionsTabs accountId={account?.id} /></div>
        <Card>
          <CardHeader title="Performance" sub="From closed trades on this account" />
          {!data ? <Skeleton className="h-60" /> : (
            <div className="divide-y divide-line">
              <Kv k="Closed trades" v={data.stats.closedTrades} />
              <Kv k="Win rate" v={fmt(data.stats.winRate, (x) => `${x.toFixed(0)}%`)} />
              <Kv k="Profit factor" v={fmt(data.stats.profitFactor, (x) => x.toFixed(2))} />
              <Kv k="Avg win / avg loss" v={`${fmt(data.stats.avgWin, (x) => usd(x))} / ${fmt(data.stats.avgLoss, (x) => usd(x))}`} />
              <Kv k="Best trade" v={<span className="text-up">{fmt(data.stats.best, (x) => signed(x))}</span>} />
              <Kv k="Worst trade" v={<span className="text-down">{fmt(data.stats.worst, (x) => signed(x))}</span>} />
              <Kv k="Realized P&L" v={signed(data.stats.realized)} />
              <Kv k="Max drawdown" v={`−${data.stats.maxDrawdownPct.toFixed(1)}%`} />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
