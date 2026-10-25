"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LineChart, Search, Star } from "lucide-react";
import { Badge, Card, Change, ErrorNote, PageHeader, Skeleton, inputCls } from "@/components/ui";
import { api, refresh, useScreener, useWatchlist, type ScreenerRow } from "@/lib/hooks";
import { cn, compact, num, pct } from "@/lib/format";

type SortKey = "symbol" | "price" | "changePct" | "marketCap" | "pe" | "volume";
const val = (r: ScreenerRow, k: SortKey): number | string =>
  k === "symbol" ? r.symbol : k === "price" ? r.quote?.price ?? 0 : k === "changePct" ? r.quote?.changePct ?? 0 : k === "volume" ? r.quote?.volume ?? 0 : r[k];

export default function MarketsPage() {
  const { data, error, isLoading } = useScreener();
  const { data: wl } = useWatchlist();
  const rows = useMemo(() => data?.rows ?? [], [data]);
  const sectors = ["All", ...Array.from(new Set(rows.map((r) => r.sector)))];
  const [sector, setSector] = useState("All");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: "marketCap", dir: -1 });
  const [minCap, setMinCap] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      rows
        .filter((r) => sector === "All" || r.sector === sector)
        .filter((r) => (r.symbol + r.name).toLowerCase().includes(query.toLowerCase()))
        .filter((r) => r.marketCap >= minCap * 1e9)
        .sort((a, b) => {
          const x = val(a, sort.k), y = val(b, sort.k);
          return (typeof x === "string" ? x.localeCompare(y as string) : (x as number) - (y as number)) * sort.dir;
        }),
    [rows, sector, query, sort, minCap],
  );

  const bySector = sectors.slice(1).map((s) => {
    const g = rows.filter((r) => r.sector === s && r.quote);
    return { s, chg: g.reduce((a, r) => a + (r.quote?.changePct ?? 0), 0) / (g.length || 1), n: g.length };
  });

  const star = async (symbol: string) => {
    setMsg(null);
    try {
      if (wl?.symbols.includes(symbol)) await api("DELETE", `/api/watchlist?symbol=${symbol}`);
      else await api("POST", "/api/watchlist", { symbol });
      refresh("/api/watchlist");
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  const th = (k: SortKey, label: string, right = true) => (
    <th className={cn("px-3 py-2.5 text-[11px] font-normal text-dim", right ? "text-right" : "text-left")} aria-sort={sort.k === k ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
      <button onClick={() => setSort((s) => ({ k, dir: s.k === k ? (s.dir === 1 ? -1 : 1) : -1 }))} className="hover:text-text">
        {label} {sort.k === k ? (sort.dir === 1 ? "↑" : "↓") : ""}
      </button>
    </th>
  );

  return (
    <div className="fade-up space-y-6">
      <PageHeader icon={<LineChart size={20} />} title="Markets" accent="& screener" sub={`${rows.length || "…"} liquid US stocks and ETFs${data?.source === "demo" ? " · demo prices" : ""}`} />
      <ErrorNote error={error} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-9">
        {isLoading && Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        {bySector.map((b) => (
          <button key={b.s} onClick={() => setSector(sector === b.s ? "All" : b.s)} className={cn("rounded-2xl border p-3 text-left transition", sector === b.s ? "border-blue-2" : "border-line")}
            style={{ background: `linear-gradient(160deg, ${b.chg >= 0 ? `rgba(47,224,160,${Math.min(0.28, Math.abs(b.chg) / 6)})` : `rgba(255,77,109,${Math.min(0.28, Math.abs(b.chg) / 6)})`}, rgba(10,13,34,.7))` }}>
            <p className="truncate text-xs text-muted">{b.s}</p>
            <p className={cn("num mt-1 text-sm font-medium", b.chg >= 0 ? "text-up" : "text-down")}>{pct(b.chg)}</p>
            <p className="text-[10px] text-dim">{b.n} symbols</p>
          </button>
        ))}
      </div>

      <Card className="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <div className="relative w-full max-w-xs">
            <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-dim" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by symbol or name" className={cn(inputCls, "h-10 pl-9")} />
          </div>
          <div className="w-44">
            <select value={sector} onChange={(e) => setSector(e.target.value)} className={cn(inputCls, "h-10")} aria-label="Sector">
              {sectors.map((s) => <option key={s} className="bg-panel">{s}</option>)}
            </select>
          </div>
          <div className="w-52">
            <select value={minCap} onChange={(e) => setMinCap(Number(e.target.value))} className={cn(inputCls, "h-10")} aria-label="Market cap">
              <option value={0} className="bg-panel">Any market cap</option>
              <option value={200} className="bg-panel">Mega cap (&gt; $200B)</option>
              <option value={1000} className="bg-panel">&gt; $1T</option>
            </select>
          </div>
          <span className="ml-auto text-xs text-muted">{filtered.length} results</span>
        </div>
        {msg && <p className="border-b border-line bg-down/10 px-4 py-2 text-xs text-down">{msg}</p>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-[13px]">
            <thead>
              <tr className="border-b border-line">
                <th className="w-10" />
                {th("symbol", "Symbol", false)}
                <th className="px-3 py-2.5 text-left text-[11px] font-normal text-dim">Sector</th>
                {th("price", "Price")}
                {th("changePct", "Change")}
                {th("volume", "Volume")}
                {th("marketCap", "Mkt cap (approx.)")}
                {th("pe", "P/E")}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((r) => {
                const starred = wl?.symbols.includes(r.symbol);
                return (
                  <tr key={r.symbol} className="hover:bg-white/[0.02]">
                    <td className="pl-4">
                      <button onClick={() => star(r.symbol)} aria-label={starred ? `Remove ${r.symbol} from watchlist` : `Add ${r.symbol} to watchlist`} className={starred ? "text-warn" : "text-dim hover:text-warn"}>
                        <Star size={14} fill={starred ? "currentColor" : "none"} />
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <Link href={`/symbol/${r.symbol}`} className="flex items-center gap-3">
                        <span className="grid size-8 place-items-center rounded-full bg-white/[0.06] text-[10px] font-bold">{r.symbol.slice(0, 2)}</span>
                        <span>
                          <span className="block font-medium hover:text-blue-glow">{r.symbol}</span>
                          <span className="block text-[11px] text-dim">{r.name}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-3"><Badge>{r.sector}</Badge></td>
                    <td className="num px-3 text-right">{r.quote ? num(r.quote.price) : "—"}</td>
                    <td className="px-3 text-right">{r.quote ? <Change value={r.quote.changePct} /> : "—"}</td>
                    <td className="num px-3 text-right text-muted">{r.quote?.volume ? compact(r.quote.volume) : "—"}</td>
                    <td className="num px-3 text-right">${compact(r.marketCap)}</td>
                    <td className="num px-3 text-right text-muted">{r.pe ? r.pe.toFixed(1) : "—"}</td>
                  </tr>
                );
              })}
              {isLoading && Array.from({ length: 8 }).map((_, i) => <tr key={i}><td colSpan={8} className="px-4 py-2"><Skeleton className="h-8 w-full" /></td></tr>)}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
