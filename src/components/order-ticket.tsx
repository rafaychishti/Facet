"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { api, refresh, useAccount, useQuote, type Account } from "@/lib/hooks";
import { cn, usd } from "@/lib/format";
import { inputCls } from "./ui";

type Side = "buy" | "sell";
type OrderType = "market" | "limit" | "stop" | "stop_limit";
const TYPES: { id: OrderType; label: string }[] = [
  { id: "market", label: "Market" }, { id: "limit", label: "Limit" }, { id: "stop", label: "Stop" }, { id: "stop_limit", label: "Stop-Limit" },
];

export function OrderTicket({ symbol, account }: { symbol: string; account?: Account }) {
  const { quote, market } = useQuote(symbol);
  const { data: detail } = useAccount(account?.id);
  const [side, setSide] = useState<Side>("buy");
  const [type, setType] = useState<OrderType>("market");
  const [qty, setQty] = useState(10);
  const [limit, setLimit] = useState("");
  const [stop, setStop] = useState("");
  const [bracket, setBracket] = useState(false);
  const [tp, setTp] = useState("");
  const [sl, setSl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const price = quote?.price ?? 0;
  const ref = type === "limit" || type === "stop_limit" ? Number(limit) || price : type === "stop" ? Number(stop) || price : price;
  const est = ref * qty;
  const pos = detail?.holdings.find((h) => h.symbol === symbol);
  const prefill = (setter: (v: string) => void, mult: number) => () => setter((price * mult).toFixed(2));

  const submit = async () => {
    if (!account) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ message: string }>("POST", "/api/orders", {
        accountId: account.id, symbol, side, type, qty,
        limitPrice: type === "limit" || type === "stop_limit" ? Number(limit) : null,
        stopPrice: type === "stop" || type === "stop_limit" ? Number(stop) : null,
        takeProfit: bracket && side === "buy" && tp ? Number(tp) : null,
        stopLoss: bracket && side === "buy" && sl ? Number(sl) : null,
      });
      setMsg({ ok: true, text: r.message });
      refresh("/api/accounts", "/api/challenges", "/api/me");
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {account && (
        <p className="flex items-center justify-between text-[11px] text-muted">
          <span className="truncate">Account: <b className="font-medium text-text">{account.name}</b></span>
          {market && <span className={market.open ? "text-up" : "text-dim"}>● {market.label}</span>}
        </p>
      )}
      <div className="grid grid-cols-2 rounded-xl bg-white/[0.03] p-1">
        {(["buy", "sell"] as Side[]).map((s) => (
          <button key={s} onClick={() => setSide(s)} className={cn("h-9 rounded-lg text-sm font-medium capitalize transition", side === s ? (s === "buy" ? "bg-up text-[#03140d]" : "bg-down text-white") : "text-muted hover:text-text")}>
            {s}
          </button>
        ))}
      </div>

      <div className="flex gap-1 text-xs">
        {TYPES.map((t) => (
          <button key={t.id} onClick={() => { setType(t.id); if (!limit) setLimit(price.toFixed(2)); if (!stop) setStop(price.toFixed(2)); }} className={cn("flex-1 rounded-lg border py-1.5 transition", type === t.id ? "border-blue-2 bg-blue/15 text-text" : "border-line text-muted hover:text-text")}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-[11px] text-muted">Quantity (shares)</span>
          <input type="number" min={1} step={1} value={qty} onChange={(e) => setQty(Math.max(1, Math.floor(Number(e.target.value) || 1)))} className={cn(inputCls, "num h-10")} />
        </label>
        {type === "market" && (
          <label className="block">
            <span className="mb-1 block text-[11px] text-muted">Market price</span>
            <input disabled value={price ? price.toFixed(2) : "…"} className={cn(inputCls, "num h-10 disabled:text-muted")} />
          </label>
        )}
        {(type === "stop" || type === "stop_limit") && (
          <label className="block">
            <span className="mb-1 block text-[11px] text-muted">Stop price</span>
            <input inputMode="decimal" value={stop} onChange={(e) => setStop(e.target.value)} onFocus={() => !stop && setStop(price.toFixed(2))} className={cn(inputCls, "num h-10")} />
          </label>
        )}
        {(type === "limit" || type === "stop_limit") && (
          <label className={cn("block", type === "stop_limit" && "col-span-2")}>
            <span className="mb-1 block text-[11px] text-muted">Limit price</span>
            <input inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} onFocus={() => !limit && setLimit(price.toFixed(2))} className={cn(inputCls, "num h-10")} />
          </label>
        )}
      </div>

      {side === "buy" && (
        <label className="flex cursor-pointer items-center justify-between rounded-xl border border-line px-3 py-2.5 text-xs">
          <span>Take-profit / Stop-loss</span>
          <input type="checkbox" checked={bracket} onChange={(e) => { setBracket(e.target.checked); if (!tp) prefill(setTp, 1.05)(); if (!sl) prefill(setSl, 0.97)(); }} className="accent-[#4d6bff]" />
        </label>
      )}
      {bracket && side === "buy" && (
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-[11px] text-up">Take profit</span>
            <input inputMode="decimal" value={tp} onChange={(e) => setTp(e.target.value)} className={cn(inputCls, "num h-10")} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] text-down">Stop loss</span>
            <input inputMode="decimal" value={sl} onChange={(e) => setSl(e.target.value)} className={cn(inputCls, "num h-10")} />
          </label>
        </div>
      )}

      <div className="space-y-1.5 rounded-xl border border-line bg-white/[0.02] p-3 text-xs">
        <div className="flex justify-between"><span className="text-muted">Estimated {side === "buy" ? "cost" : "proceeds"}</span><span className="num">{usd(est)}</span></div>
        <div className="flex justify-between"><span className="text-muted">Buying power</span><span className="num">{account ? usd(account.cash) : "—"}</span></div>
        <div className="flex justify-between"><span className="text-muted">Position</span><span className="num">{pos ? `${pos.qty} sh @ ${usd(pos.avg_price)}` : "None"}</span></div>
      </div>

      <button onClick={submit} disabled={busy || !account || !price} className={cn("flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition hover:brightness-110 disabled:opacity-50", side === "buy" ? "bg-up text-[#03140d]" : "bg-down text-white")}>
        {busy && <Loader2 size={15} className="animate-spin" />}
        {side === "buy" ? "Buy" : "Sell"} {qty} {symbol} {type !== "market" && `· ${TYPES.find((t) => t.id === type)?.label}`}
      </button>
      {msg && <p role="status" className={cn("rounded-lg px-3 py-2 text-xs", msg.ok ? "bg-up/10 text-up" : "bg-down/10 text-down")}>{msg.text}</p>}
      <p className="text-center text-[10px] text-dim">Simulated order. No real money is used.</p>
    </div>
  );
}
