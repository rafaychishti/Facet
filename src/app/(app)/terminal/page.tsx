"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, Star } from "lucide-react";
import { AccountSwitcher } from "@/components/account-switcher";
import { PriceChart } from "@/components/charts/price-chart";
import { OrderTicket } from "@/components/order-ticket";
import { PositionsTabs } from "@/components/positions-table";
import { Change, Skeleton } from "@/components/ui";
import { api, refresh, useAccount, useActiveAccount, useQuotes, useWatchlist } from "@/lib/hooks";
import { UNIVERSE, universeItem } from "@/lib/market/universe";
import { cn, compact, num, usd } from "@/lib/format";

export default function TerminalPage() {
  const { data: wl } = useWatchlist();
  const { accounts, account, choose } = useActiveAccount();
  const { data: detail } = useAccount(account?.id);
  const watch = wl?.symbols.length ? wl.symbols : UNIVERSE.slice(0, 8).map((u) => u.symbol);
  const [picked, setPicked] = useState<string | null>(null);
  const symbol = picked ?? watch[0] ?? "AAPL";
  const trendingSyms = UNIVERSE.slice(0, 16).map((u) => u.symbol);
  const { map } = useQuotes([...new Set([...watch, ...trendingSyms, symbol])]);
  const q = map.get(symbol);
  const meta = universeItem(symbol);
  const starred = wl?.symbols.includes(symbol);

  const pos = detail?.holdings.find((h) => h.symbol === symbol);
  const lines = [
    ...(pos ? [{ price: pos.avg_price, color: "#2fe0a0", title: `Avg ${pos.qty}` }] : []),
    ...(detail?.orders ?? [])
      .filter((o) => o.status === "working" && o.symbol === symbol)
      .map((o) => ({ price: Number(o.limit_price ?? o.stop_price), color: o.side === "buy" ? "#4d6bff" : "#ffb547", title: `${o.side} ${o.type.replace("_", "-")}` }))
      .filter((l) => l.price > 0),
  ];

  const toggleStar = async () => {
    if (starred) await api("DELETE", `/api/watchlist?symbol=${symbol}`);
    else await api("POST", "/api/watchlist", { symbol });
    refresh("/api/watchlist");
  };

  return (
    <div className="fade-up -mx-2 space-y-4 sm:mx-0">
      <div className="glass flex items-center gap-4 overflow-hidden px-4 py-2.5">
        <span className="shrink-0 text-xs font-medium text-muted">Trending</span>
        <div className="relative flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_6%,#000_94%,transparent)]">
          <div className="animate-ticker flex w-max gap-6">
            {[...trendingSyms, ...trendingSyms].map((s, i) => {
              const x = map.get(s);
              return (
                <button key={i} onClick={() => setPicked(s)} className="flex items-center gap-2 text-xs whitespace-nowrap">
                  <span className="font-medium">{s}</span>
                  <span className="num text-muted">{x ? num(x.price) : "—"}</span>
                  {x && <Change value={x.changePct} />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_300px] xl:items-start">
        <div className="glass order-2 overflow-hidden p-0 xl:order-1">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-sm font-medium">{wl?.name ?? "Watchlist"}</span>
            <span className="text-[11px] text-dim">{watch.length} symbols</span>
          </div>
          <div className="max-h-[560px] overflow-y-auto">
            {watch.map((s) => {
              const xq = map.get(s);
              return (
                <button key={s} onClick={() => setPicked(s)} className={cn("flex w-full items-center justify-between gap-2 border-l-2 px-4 py-2.5 text-left transition", symbol === s ? "border-blue-2 bg-blue/10" : "border-transparent hover:bg-white/[0.03]")}>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium">{s}</p>
                    <p className="truncate text-[11px] text-dim">{universeItem(s)?.name ?? ""}</p>
                  </div>
                  <div className="text-right">
                    <p className="num text-[13px]">{xq ? num(xq.price) : "—"}</p>
                    {xq && <Change value={xq.changePct} className="text-[11px] whitespace-nowrap" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="glass order-1 overflow-hidden p-0 xl:order-2">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-blue-2 to-violet text-[11px] font-bold">{symbol.slice(0, 2)}</span>
              <div>
                <Link href={`/symbol/${symbol}`} className="text-[15px] font-medium hover:text-blue-glow">{symbol}</Link>
                <p className="text-[11px] text-dim">{meta ? `${meta.name} · ${meta.exchange}` : "US equity"}</p>
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              {q ? <span className="num text-2xl font-medium">{usd(q.price)}</span> : <Skeleton className="h-7 w-24" />}
              {q && <Change value={q.changePct} className="text-sm" />}
            </div>
            {q && (
              <div className="num hidden gap-5 text-xs text-muted md:flex">
                <span>Open <b className="text-text">{num(q.open)}</b></span>
                <span>High <b className="text-text">{num(q.high)}</b></span>
                <span>Low <b className="text-text">{num(q.low)}</b></span>
                {q.volume > 0 && <span>Vol <b className="text-text">{compact(q.volume)}</b></span>}
              </div>
            )}
            <div className="ml-auto flex gap-1.5">
              <button onClick={toggleStar} className={cn("grid size-8 place-items-center rounded-lg border border-line hover:text-warn", starred ? "text-warn" : "text-muted")} aria-label={starred ? "Remove from watchlist" : "Add to watchlist"}>
                <Star size={15} fill={starred ? "currentColor" : "none"} />
              </button>
              <Link href={`/alerts?symbol=${symbol}`} className="grid size-8 place-items-center rounded-lg border border-line text-muted hover:text-text" aria-label="Create alert"><Bell size={15} /></Link>
            </div>
          </div>
          <PriceChart symbol={symbol} height={480} defaultIndicators={["vol", "sma20", "ema50"]} priceLines={lines} />
        </div>

        <div className="glass order-3 space-y-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Place order</p>
            <AccountSwitcher accounts={accounts} value={account?.id} onChange={choose} />
          </div>
          {account ? <OrderTicket key={`${symbol}:${account.id}`} symbol={symbol} account={account} /> : <Skeleton className="h-96 w-full" />}
        </div>
      </div>

      <div className="glass overflow-hidden p-0">
        <PositionsTabs accountId={account?.id} compact />
      </div>
    </div>
  );
}
