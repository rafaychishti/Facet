"use client";

import Link from "next/link";
import { Bell, ExternalLink, Newspaper, Star } from "lucide-react";
import { AccountSwitcher } from "@/components/account-switcher";
import { PriceChart } from "@/components/charts/price-chart";
import { OrderTicket } from "@/components/order-ticket";
import { Badge, Button, Card, CardHeader, Change, EmptyState, Kv, Skeleton } from "@/components/ui";
import { api, refresh, useActiveAccount, useNews, useProfile, useQuote, useWatchlist } from "@/lib/hooks";
import { compact, num, signed, usd } from "@/lib/format";

const ago = (t: number) => {
  const m = Math.round((Date.now() / 1000 - t) / 60);
  return m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`;
};

export function SymbolView({ symbol }: { symbol: string }) {
  const { quote: q, market, isLoading } = useQuote(symbol);
  const { data: prof, error: profErr } = useProfile(symbol);
  const { data: news } = useNews(symbol);
  const { data: wl } = useWatchlist();
  const { accounts, account, choose } = useActiveAccount();
  const p = prof?.profile;
  const starred = wl?.symbols.includes(symbol);
  const pos52 = p?.week52High && p.week52Low && q ? ((q.price - p.week52Low) / (p.week52High - p.week52Low)) * 100 : null;

  if (!isLoading && !q && profErr) {
    return <EmptyState title={`We couldn't find ${symbol}`} body="Facet covers US-listed stocks and ETFs. Check the ticker and try again." action={<Link href="/markets" className="text-blue-glow hover:underline">Browse markets</Link>} />;
  }

  const toggleStar = async () => {
    if (starred) await api("DELETE", `/api/watchlist?symbol=${symbol}`);
    else await api("POST", "/api/watchlist", { symbol });
    refresh("/api/watchlist");
  };

  return (
    <div className="fade-up space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          {p?.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.logo} alt="" className="size-14 rounded-2xl bg-white object-contain p-1.5" />
          ) : (
            <span className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-blue-2 to-violet text-base font-bold shadow-[0_0_40px_-8px_rgba(77,107,255,.8)]">{symbol.slice(0, 2)}</span>
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-medium">{p?.name ?? symbol}</h1>
              <Badge tone="blue">{symbol}</Badge>
              {p?.exchange && <Badge>{p.exchange}</Badge>}
            </div>
            <div className="mt-1 flex flex-wrap items-baseline gap-3">
              {q ? <span className="num text-3xl font-medium">{usd(q.price)}</span> : <Skeleton className="h-8 w-28" />}
              {q && <span className={q.change >= 0 ? "num text-up" : "num text-down"}>{signed(q.change)}</span>}
              {q && <Change value={q.changePct} />}
              {market && <span className="text-xs text-dim">{market.label}</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={toggleStar}><Star size={15} fill={starred ? "currentColor" : "none"} className={starred ? "text-warn" : ""} /> {starred ? "Watching" : "Watchlist"}</Button>
          <Link href={`/alerts?symbol=${symbol}`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-line-strong bg-white/[0.03] px-4 text-sm hover:bg-white/[0.07]"><Bell size={15} /> Alert</Link>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <div className="glass overflow-hidden p-0">
            <PriceChart symbol={symbol} height={460} defaultTf="1D" defaultIndicators={["vol", "bb"]} />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader title="Key statistics" />
              {!q ? <Skeleton className="h-56" /> : (
                <>
                  <div className="divide-y divide-line">
                    <Kv k="Open" v={num(q.open)} />
                    <Kv k="Previous close" v={num(q.prevClose)} />
                    <Kv k="Day range" v={`${num(q.low)} – ${num(q.high)}`} />
                    {q.volume > 0 && <Kv k="Volume" v={compact(q.volume)} />}
                    <Kv k="Market cap" v={p?.marketCap ? `$${compact(p.marketCap)}` : "—"} />
                    <Kv k="P/E ratio (TTM)" v={p?.pe ? p.pe.toFixed(1) : "—"} />
                  </div>
                  {pos52 !== null && (
                    <div className="mt-4">
                      <div className="mb-1.5 flex justify-between text-[11px] text-muted"><span>52W low {num(p!.week52Low!)}</span><span>52W high {num(p!.week52High!)}</span></div>
                      <div className="relative h-1.5 rounded-full bg-gradient-to-r from-down/60 via-white/10 to-up/60">
                        <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bg bg-text" style={{ left: `${Math.min(100, Math.max(0, pos52))}%` }} />
                      </div>
                    </div>
                  )}
                </>
              )}
            </Card>
            <Card>
              <CardHeader title="About" />
              {!p ? <Skeleton className="h-40" /> : (
                <>
                  <div className="divide-y divide-line">
                    <Kv k="Industry" v={p.sector} />
                    <Kv k="Exchange" v={p.exchange} />
                    {p.country && <Kv k="Country" v={p.country} />}
                    <Kv k="Currency" v={p.currency} />
                    {p.ipo && <Kv k="IPO" v={p.ipo} />}
                  </div>
                  {p.weburl && <a href={p.weburl} target="_blank" rel="noreferrer noopener" className="mt-3 inline-flex items-center gap-1 text-xs text-blue-glow hover:underline">Company website <ExternalLink size={12} /></a>}
                </>
              )}
            </Card>
          </div>

          <Card>
            <CardHeader title={`${symbol} news`} icon={<Newspaper size={16} />} sub={news?.source === "demo" ? "Demo headlines: add a Finnhub key for real news" : "Last 7 days"} />
            <div className="divide-y divide-line">
              {!news && <Skeleton className="h-40" />}
              {news?.news.length === 0 && <p className="py-6 text-center text-sm text-muted">No recent news for {symbol}.</p>}
              {news?.news.slice(0, 10).map((n) => (
                <a key={n.id} href={n.url} target="_blank" rel="noreferrer noopener" className="flex gap-4 py-3.5 hover:opacity-90">
                  <div className="flex-1">
                    <p className="mb-1 text-[11px] text-dim"><span className="text-muted">{n.source}</span> · {ago(n.datetime)} ago</p>
                    <h4 className="text-sm font-medium">{n.headline}</h4>
                    {n.summary && <p className="mt-1 line-clamp-2 text-xs text-muted">{n.summary}</p>}
                  </div>
                </a>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card glow>
            <div className="mb-4 flex items-center justify-between gap-2">
              <h3 className="text-[15px] font-medium">Paper trade</h3>
              <AccountSwitcher accounts={accounts} value={account?.id} onChange={choose} />
            </div>
            {account ? <OrderTicket key={account.id} symbol={symbol} account={account} /> : <Skeleton className="h-96" />}
          </Card>
        </div>
      </div>
    </div>
  );
}
