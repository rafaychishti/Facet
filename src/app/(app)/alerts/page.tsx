"use client";

import { useState } from "react";
import { BellPlus, Mail, Pause, Play, Siren, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardHeader, EmptyState, Field, PageHeader, Skeleton, inputCls, statusTone } from "@/components/ui";
import { api, refresh, useAlerts, useQuote, useSearchParam, type Alert } from "@/lib/hooks";
import { UNIVERSE } from "@/lib/market/universe";
import { num } from "@/lib/format";

const CONDITIONS: { id: Alert["condition"]; label: string; unit: string }[] = [
  { id: "price_above", label: "Price rises above", unit: "$" },
  { id: "price_below", label: "Price falls below", unit: "$" },
  { id: "pct_change_above", label: "Up today by more than", unit: "%" },
  { id: "pct_change_below", label: "Down today by more than", unit: "%" },
];

export default function AlertsPage() {
  const { data, isLoading } = useAlerts();
  const urlSymbol = useSearchParam("symbol");
  const [picked, setSymbol] = useState<string | null>(null);
  const symbol = picked ?? urlSymbol?.toUpperCase() ?? "AAPL";
  const [condition, setCondition] = useState<Alert["condition"]>("price_above");
  const [value, setValue] = useState("");
  const [email, setEmail] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { quote } = useQuote(symbol);


  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api("POST", "/api/alerts", { symbol, condition, value: Number(value), notifyEmail: email });
      setValue("");
      refresh("/api/alerts");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const update = async (fn: () => Promise<unknown>) => {
    await fn().catch((e) => setErr((e as Error).message));
    refresh("/api/alerts");
  };

  const active = data?.alerts.filter((a) => a.status === "active").length ?? 0;
  const unit = CONDITIONS.find((c) => c.id === condition)!.unit;

  return (
    <div className="fade-up space-y-6">
      <PageHeader icon={<Siren size={20} />} title="Price" accent="alerts" sub="Checked every 20 seconds while markets are open. You'll get an in-app notification, plus email if enabled." />
      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card glow>
          <CardHeader title="New alert" icon={<BellPlus size={16} />} />
          <form onSubmit={add} className="space-y-4">
            <Field label="Symbol">
              <input list="alert-symbols" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} className={inputCls} maxLength={10} required />
              <datalist id="alert-symbols">{UNIVERSE.map((u) => <option key={u.symbol} value={u.symbol}>{u.name}</option>)}</datalist>
            </Field>
            <Field label="Condition">
              <select value={condition} onChange={(e) => setCondition(e.target.value as Alert["condition"])} className={inputCls}>
                {CONDITIONS.map((c) => <option key={c.id} value={c.id} className="bg-panel">{c.label}</option>)}
              </select>
            </Field>
            <Field label={`Value (${unit})`} hint={quote ? `Last ${num(quote.price)} · today ${quote.changePct >= 0 ? "+" : ""}${quote.changePct.toFixed(2)}%` : " "}>
              <input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder={unit === "$" ? quote?.price.toFixed(2) : "2.5"} className={inputCls + " num"} required />
            </Field>
            <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} className="accent-[#4d6bff]" /><Mail size={13} /> Also email me</label>
            {err && <p role="alert" className="rounded-lg bg-down/10 px-3 py-2 text-xs text-down">{err}</p>}
            <Button className="w-full" disabled={busy}>Create alert</Button>
          </form>
        </Card>
        <Card className="p-0">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h3 className="text-[15px] font-medium">Your alerts</h3>
            <span className="text-xs text-muted">{active} active{data?.limit ? ` · Free plan: ${data.limit} max` : " · Pro: unlimited"}</span>
          </div>
          {isLoading && <div className="p-5"><Skeleton className="h-40" /></div>}
          {data && data.alerts.length === 0 && <EmptyState icon={<Siren size={18} />} title="No alerts yet" body="Create one on the left and we'll watch the price for you." />}
          <div className="divide-y divide-line">
            {data?.alerts.map((a) => {
              const c = CONDITIONS.find((x) => x.id === a.condition)!;
              return (
                <div key={a.id} className="flex items-center gap-4 px-5 py-3.5">
                  <span className="grid size-9 place-items-center rounded-full bg-white/[0.05] text-[11px] font-bold">{a.symbol.slice(0, 2)}</span>
                  <div className="flex-1">
                    <p className="text-sm"><b className="font-medium">{a.symbol}</b> <span className="text-muted">{c.label.toLowerCase()}</span> <span className="num">{c.unit === "$" ? `$${num(a.value)}` : `${a.value}%`}</span></p>
                    <p className="text-[11px] text-dim">{a.triggered_at ? `Triggered ${new Date(a.triggered_at).toLocaleString()}` : `Created ${new Date(a.created_at).toLocaleDateString()}`}{a.notify_email && " · email"}</p>
                  </div>
                  <Badge tone={statusTone(a.status === "active" ? "Active" : a.status === "triggered" ? "Triggered" : "Paused")}>{a.status}</Badge>
                  {a.status === "active" ? (
                    <button onClick={() => update(() => api("PATCH", `/api/alerts/${a.id}`, { status: "paused" }))} className="text-dim hover:text-text" aria-label="Pause alert"><Pause size={15} /></button>
                  ) : (
                    <button onClick={() => update(() => api("PATCH", `/api/alerts/${a.id}`, { status: "active" }))} className="text-dim hover:text-text" aria-label={a.status === "triggered" ? "Re-arm alert" : "Resume alert"}><Play size={15} /></button>
                  )}
                  <button onClick={() => update(() => api("DELETE", `/api/alerts/${a.id}`))} className="text-dim hover:text-down" aria-label="Delete alert"><Trash2 size={15} /></button>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
