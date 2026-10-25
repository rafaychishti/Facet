"use client";

import Link from "next/link";
import { ArrowRight, Flag, LayoutGrid, Newspaper, Rocket, Star, TrendingUp, Wallet } from "lucide-react";
import { LineChart } from "@/components/charts/line-chart";
import { Badge, Card, CardHeader, Change, EmptyState, LinkButton, PageHeader, Progress, Skeleton } from "@/components/ui";
import { useAccount, useAccounts, useChallenges, useMe, useNews, useQuotes, useWatchlist } from "@/lib/hooks";
import { INDEX_PROXIES, UNIVERSE } from "@/lib/market/universe";
import { cn, num, pct, signed, usd } from "@/lib/format";

const ago = (t: number) => {
  const m = Math.round((Date.now() / 1000 - t) / 60);
  return m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`;
};

export default function OverviewPage() {
  const { data: me } = useMe();
  const { data: accts } = useAccounts();
  const paper = accts?.accounts.find((a) => a.kind === "paper");
  const { data: paperDetail } = useAccount(paper?.id);
  const { data: wl } = useWatchlist();
  const { data: ch } = useChallenges();
  const { data: news } = useNews();
  const watch = wl?.symbols ?? [];
  const { map, market } = useQuotes([...INDEX_PROXIES.map((i) => i.symbol), ...watch, ...UNIVERSE.slice(0, 20).map((u) => u.symbol)]);
  const movers = UNIVERSE.slice(0, 20).map((u) => map.get(u.symbol)).filter(Boolean).sort((a, b) => Math.abs(b!.changePct) - Math.abs(a!.changePct)).slice(0, 5);
  const active = ch?.challenges.find((c) => c.status === "active");
  const first = me?.profile?.full_name?.split(" ")[0];

  const curve = paperDetail ? [...paperDetail.snapshots.map((s) => ({ time: s.day, value: s.equity })), { time: new Date().toISOString().slice(0, 10), value: paperDetail.account.equity }] : [];
  const dedup = curve.filter((p, i) => i === curve.length - 1 || p.time !== curve[curve.length - 1].time);

  return (
    <div className="fade-up space-y-6">
      <PageHeader
        icon={<LayoutGrid size={20} />}
        title={first ? `Welcome back, ${first}` : "Welcome back"}
        sub={market ? `${market.label} · prices refresh every 15 seconds` : " "}
        actions={
          <>
            <LinkButton href="/terminal" variant="outline">Open terminal</LinkButton>
            <LinkButton href="/challenges"><Rocket size={15} /> Start challenge</LinkButton>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {INDEX_PROXIES.map((i) => {
          const q = map.get(i.symbol);
          return (
            <Link key={i.symbol} href={`/symbol/${i.symbol}`} className="glass px-4 py-3 hover:border-line-strong">
              <p className="text-xs text-muted">{i.label} <span className="text-dim">· {i.symbol}</span></p>
              <div className="mt-1 flex items-baseline justify-between gap-2">
                {q ? <span className="num text-[15px] font-medium">{num(q.price)}</span> : <Skeleton className="h-5 w-20" />}
                {q && <Change value={q.changePct} className="text-xs" />}
              </div>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card glow className="xl:col-span-2">
          <CardHeader title="Paper account" icon={<Wallet size={16} />} sub={paper ? `Simulated · started with ${usd(paper.starting_balance, 0)}` : " "} action={<Link href="/portfolio" className="text-xs text-blue-glow hover:underline">View portfolio →</Link>} />
          {!paper ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <div className="grid gap-6 sm:grid-cols-[1.2fr_1fr]">
              <div>
                <p className="text-xs text-muted">Total equity</p>
                <p className="num mt-1 text-4xl font-medium tracking-tight">{usd(paper.equity)}</p>
                <p className={cn("num mt-1 text-sm", paper.pnl >= 0 ? "text-up" : "text-down")}>{signed(paper.pnl)} ({pct(paper.pnlPct)}) all time</p>
                <div className="mt-3">
                  {dedup.length > 1 ? (
                    <LineChart lines={[{ name: "Equity", color: "#6f8bff", area: true, data: dedup }]} height={120} />
                  ) : (
                    <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-xs text-muted">Your equity curve fills in after the first market close.</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 self-start">
                {[
                  ["Cash", usd(paper.cash)],
                  ["Invested", usd(paper.invested)],
                  ["Open positions", paper.positions],
                  ["Working orders", paperDetail?.orders.filter((o) => o.status === "working").length ?? "—"],
                ].map(([k, v]) => (
                  <div key={k as string} className="rounded-xl border border-line bg-white/[0.02] p-3">
                    <p className="text-[11px] text-muted">{k}</p>
                    <p className="num mt-1 text-[15px]">{v}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Active challenge" icon={<Flag size={16} />} sub={active ? `${active.plan.name} · ${usd(active.plan.size, 0)} · ${active.phase === 3 ? "Funded (sim)" : `Phase ${active.phase}`}` : undefined} action={active && <Badge tone="violet">In progress</Badge>} />
          {!ch ? (
            <Skeleton className="h-40 w-full" />
          ) : !active ? (
            <EmptyState icon={<Flag size={18} />} title="No active challenge" body="Prove your edge on a simulated account with real prop-firm rules." action={<LinkButton href="/challenges" size="sm"><Rocket size={14} /> Pick a challenge</LinkButton>} />
          ) : (
            (() => {
              const targetPct = active.phase === 1 ? active.plan.profit_target_pct : active.plan.phase2_target_pct;
              const profit = active.equity - active.phase_start_balance;
              const target = active.phase_start_balance * (targetPct / 100);
              return (
                <>
                  <p className="text-xs text-muted">Challenge ID <span className="text-text">{active.public_id}</span></p>
                  <div className="mt-4 space-y-4">
                    {active.phase < 3 && (
                      <div>
                        <div className="mb-1.5 flex justify-between text-xs"><span className="text-muted">Profit target</span><span className="num">{usd(profit, 0)} / {usd(target, 0)}</span></div>
                        <Progress value={(profit / target) * 100} tone="up" striped />
                      </div>
                    )}
                    <div>
                      <div className="mb-1.5 flex justify-between text-xs"><span className="text-muted">Trading days</span><span className="num">{active.trading_days} / {active.plan.min_days}</span></div>
                      <Progress value={(active.trading_days / active.plan.min_days) * 100} tone="violet" striped />
                    </div>
                  </div>
                  <LinkButton href={`/challenges/${active.id}`} variant="outline" className="mt-5 w-full">View analytics <ArrowRight size={15} /></LinkButton>
                </>
              );
            })()
          )}
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Watchlist" icon={<Star size={16} />} action={<Link href="/markets" className="text-xs text-blue-glow hover:underline">Add symbols →</Link>} />
          {wl && watch.length === 0 && <EmptyState title="Your watchlist is empty" body="Star symbols on any stock page or from the markets screener." />}
          <div className="divide-y divide-line">
            {watch.map((s) => {
              const q = map.get(s);
              return (
                <Link key={s} href={`/symbol/${s}`} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-3 hover:bg-white/[0.02]">
                  <div>
                    <p className="text-sm font-medium">{s}</p>
                    <p className="text-xs text-muted">{UNIVERSE.find((u) => u.symbol === s)?.name ?? ""}</p>
                  </div>
                  <span className="num text-right text-sm">{q ? usd(q.price) : "—"}</span>
                  {q ? <Change value={q.changePct} className="w-20 text-right text-xs" /> : <span className="w-20" />}
                </Link>
              );
            })}
          </div>
        </Card>

        <Card>
          <CardHeader title="Top movers" icon={<TrendingUp size={16} />} sub="Largest moves among popular stocks" />
          <div className="space-y-2">
            {movers.length === 0 && Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-11 w-full" />)}
            {movers.map((q) => (
              <Link key={q!.symbol} href={`/symbol/${q!.symbol}`} className="flex items-center justify-between rounded-xl border border-line bg-white/[0.02] px-3 py-2.5 hover:border-line-strong">
                <span className="w-14 text-sm font-medium">{q!.symbol}</span>
                <span className="num text-sm text-muted">{usd(q!.price)}</span>
                <Badge tone={q!.changePct >= 0 ? "up" : "down"}>{pct(q!.changePct)}</Badge>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Market news" icon={<Newspaper size={16} />} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {!news && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
          {news?.news.slice(0, 8).map((n) => (
            <a key={n.id} href={n.url} target="_blank" rel="noreferrer noopener" className="rounded-xl border border-line bg-white/[0.02] p-4 hover:border-line-strong">
              <p className="mb-2 text-[11px] text-dim"><span className="text-muted">{n.source}</span> · {ago(n.datetime)} ago</p>
              <h4 className="line-clamp-3 text-sm leading-snug font-medium">{n.headline}</h4>
              {n.summary && <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted">{n.summary}</p>}
            </a>
          ))}
        </div>
      </Card>
    </div>
  );
}
