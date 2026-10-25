"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { api, refresh, useAccount } from "@/lib/hooks";
import { cn, num, pct, signed, usd } from "@/lib/format";
import { Badge, statusTone } from "./ui";

const typeLabel = (t: string) => t.replace("_", "-");
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });

export function PositionsTabs({ accountId, compact }: { accountId?: string; compact?: boolean }) {
  const { data, isLoading } = useAccount(accountId);
  const [tab, setTab] = useState<"positions" | "orders" | "history">("positions");
  const [err, setErr] = useState<string | null>(null);
  const holdings = data?.holdings ?? [];
  const working = (data?.orders ?? []).filter((o) => o.status === "working");
  const history = (data?.orders ?? []).filter((o) => o.status !== "working");
  const openPnl = holdings.reduce((a, h) => a + h.pnl, 0);

  const act = async (fn: () => Promise<unknown>) => {
    setErr(null);
    try {
      await fn();
      refresh("/api/accounts", "/api/challenges");
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const th = "px-3 py-2 text-left text-[11px] font-normal text-dim";
  const td = "px-3 py-2.5 num";
  const empty = (cols: number, text: string) => (
    <tr><td colSpan={cols} className="px-3 py-8 text-center text-muted">{isLoading ? "Loading…" : text}</td></tr>
  );

  return (
    <div>
      <div className="flex items-center gap-1 border-b border-line px-3">
        {([
          ["positions", `Positions (${holdings.length})`],
          ["orders", `Working orders (${working.length})`],
          ["history", "History"],
        ] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={cn("-mb-px border-b-2 px-3 py-2.5 text-xs transition", tab === k ? "border-blue-2 text-text" : "border-transparent text-muted hover:text-text")}>
            {l}
          </button>
        ))}
        {data && (
          <span className="num ml-auto hidden text-xs text-muted sm:block">
            Equity <b className="text-text">{usd(data.account.equity)}</b> · Open P&L <b className={openPnl >= 0 ? "text-up" : "text-down"}>{signed(openPnl)}</b>
          </span>
        )}
      </div>
      {err && <p className="border-b border-line bg-down/10 px-4 py-2 text-xs text-down">{err}</p>}
      <div className={cn("overflow-auto", compact ? "max-h-64" : "")}>
        {tab === "positions" && (
          <table className="w-full min-w-[680px] text-[13px]">
            <thead><tr><th className={th}>Symbol</th><th className={th}>Qty</th><th className={th}>Avg price</th><th className={th}>Last</th><th className={th}>Market value</th><th className={th}>P&L</th><th className={th}>Today</th><th className={th} /></tr></thead>
            <tbody className="divide-y divide-line">
              {holdings.map((h) => (
                <tr key={h.symbol} className="hover:bg-white/[0.02]">
                  <td className={td}><Link href={`/symbol/${h.symbol}`} className="font-medium hover:text-blue-glow">{h.symbol}</Link></td>
                  <td className={td}>{h.qty}</td>
                  <td className={td}>{usd(h.avg_price)}</td>
                  <td className={td}>{usd(h.price)}</td>
                  <td className={td}>{usd(h.value)}</td>
                  <td className={cn(td, h.pnl >= 0 ? "text-up" : "text-down")}>{signed(h.pnl)} <span className="text-[11px] opacity-70">{pct(h.pnlPct)}</span></td>
                  <td className={cn(td, h.dayChangePct >= 0 ? "text-up" : "text-down")}>{pct(h.dayChangePct)}</td>
                  <td className={td}>
                    <button onClick={() => act(() => api("POST", "/api/positions/close", { accountId, symbol: h.symbol }))} className="rounded-md border border-line px-2 py-1 text-[11px] text-muted hover:border-down/50 hover:text-down">Close</button>
                  </td>
                </tr>
              ))}
              {holdings.length === 0 && empty(8, "No open positions. Place an order from the terminal.")}
            </tbody>
          </table>
        )}
        {tab !== "positions" && (
          <table className="w-full min-w-[720px] text-[13px]">
            <thead><tr><th className={th}>Time</th><th className={th}>Symbol</th><th className={th}>Side</th><th className={th}>Type</th><th className={th}>Qty</th><th className={th}>Price</th><th className={th}>TP / SL</th><th className={th}>Status</th>{tab === "orders" && <th className={th} />}</tr></thead>
            <tbody className="divide-y divide-line">
              {(tab === "orders" ? working : history).map((o) => (
                <tr key={o.id} className="hover:bg-white/[0.02]">
                  <td className={cn(td, "text-muted")}>{when(o.filled_at ?? o.created_at)}</td>
                  <td className={cn(td, "font-medium")}>{o.symbol}{o.parent_id && <span className="ml-1 text-[10px] text-dim">bracket</span>}</td>
                  <td className={cn(td, "capitalize", o.side === "buy" ? "text-up" : "text-down")}>{o.side}</td>
                  <td className={cn(td, "capitalize")}>{typeLabel(o.type)}</td>
                  <td className={td}>{o.qty}</td>
                  <td className={td}>{o.filled_price ? num(o.filled_price) : o.limit_price ? `${num(o.limit_price)} lmt` : o.stop_price ? `${num(o.stop_price)} stp` : "Market"}</td>
                  <td className={cn(td, "text-muted")}>{o.take_profit || o.stop_loss ? `${o.take_profit ?? "—"} / ${o.stop_loss ?? "—"}` : "—"}</td>
                  <td className={td}><Badge tone={statusTone(o.status)}>{o.status}</Badge>{o.reject_reason && <span className="ml-2 text-[11px] text-dim">{o.reject_reason}</span>}</td>
                  {tab === "orders" && (
                    <td className={td}>
                      <button onClick={() => act(() => api("DELETE", `/api/orders/${o.id}`))} className="grid size-6 place-items-center rounded-md text-muted hover:bg-down/10 hover:text-down" aria-label="Cancel order"><X size={14} /></button>
                    </td>
                  )}
                </tr>
              ))}
              {(tab === "orders" ? working : history).length === 0 && empty(9, tab === "orders" ? "No working orders." : "No order history yet.")}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
