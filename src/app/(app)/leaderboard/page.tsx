"use client";

import { useState } from "react";
import { Loader2, Trophy, Users } from "lucide-react";
import { Badge, Button, Card, EmptyState, ErrorNote, PageHeader, Skeleton, statusTone } from "@/components/ui";
import { api, refresh, useCompetitions } from "@/lib/hooks";
import { cn, usd } from "@/lib/format";

const span = (a: string, b: string) => `${new Date(a).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date(b).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

export default function LeaderboardPage() {
  const [sel, setSel] = useState<string | null>(null);
  const { data, error, isLoading } = useCompetitions(sel);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const current = data?.competitions.find((c) => c.id === data.selected);
  const top = data?.leaderboard.slice(0, 3) ?? [];

  const join = async () => {
    if (!current) return;
    setBusy(true);
    setMsg(null);
    try {
      await api("POST", "/api/competitions", { competitionId: current.id });
      setMsg({ ok: true, text: `You're in! Trade using the "${current.name}" account in the terminal.` });
      refresh("/api/competitions", "/api/accounts");
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fade-up space-y-6">
      <PageHeader
        icon={<Trophy size={20} />} title="Leaderboard" accent="& competitions"
        sub={current ? `${current.name} · ${span(current.starts_at, current.ends_at)} · ranked by return on a ${usd(current.size, 0)} simulated account` : " "}
        actions={current && current.status !== "Ended" && !current.joined && <Button onClick={join} disabled={busy}>{busy && <Loader2 size={15} className="animate-spin" />} Join {current.name}</Button>}
      />
      <ErrorNote error={error} />
      {msg && <p role="status" className={cn("rounded-xl px-4 py-3 text-sm", msg.ok ? "bg-up/10 text-up" : "bg-down/10 text-down")}>{msg.text}</p>}

      <div className="flex flex-wrap gap-2">
        {data?.competitions.map((c) => (
          <button key={c.id} onClick={() => setSel(c.id)} className={cn("flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs transition", c.id === data.selected ? "border-blue-2 bg-blue/15 text-text" : "border-line text-muted hover:text-text")}>
            {c.name} <Badge tone={statusTone(c.status)}>{c.status}</Badge>{c.joined && <Badge tone="blue">Joined</Badge>}
          </button>
        ))}
      </div>

      {current && (
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            [<Users key="u" size={16} />, data!.entrants.toLocaleString(), "Entrants"],
            [<Trophy key="t" size={16} />, current.prize, "Prize"],
            [<Trophy key="s" size={16} />, usd(current.size, 0), "Simulated account size"],
          ].map(([icon, v, l], i) => (
            <Card key={i} className="flex items-center gap-4 py-4">
              <span className="grid size-10 place-items-center rounded-xl bg-blue/15 text-blue-glow">{icon}</span>
              <div><p className="num text-lg font-medium">{v}</p><p className="text-xs text-muted">{l}</p></div>
            </Card>
          ))}
        </div>
      )}

      {top.length > 0 && (
        <div className="grid gap-5 md:grid-cols-3">
          {top.map((t, i) => (
            <Card key={t.rank} glow={i === 0} className={cn(i === 0 && "bg-blue/[0.06]")}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-xl bg-gradient-to-br from-blue-2 to-violet text-sm font-semibold">{t.name.split(" ").map((s) => s[0]).join("").slice(0, 2)}</span>
                  <div><p className="font-medium">{t.name}</p><p className="text-xs text-muted">{t.handle ? `@${t.handle}` : ""}{t.country ? ` · ${t.country}` : ""}</p></div>
                </div>
                <Badge tone="blue">#{t.rank}</Badge>
              </div>
              <p className="num mt-5 text-2xl font-medium">{usd(t.equity, 0)}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div><p className="text-muted">Return</p><p className={cn("num", t.returnPct >= 0 ? "text-up" : "text-down")}>{t.returnPct >= 0 ? "+" : ""}{t.returnPct}%</p></div>
                <div><p className="text-muted">Trades</p><p className="num">{t.trades}</p></div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card className="p-0">
        {isLoading && <div className="p-5"><Skeleton className="h-60" /></div>}
        {data && data.leaderboard.length === 0 && <EmptyState icon={<Trophy size={18} />} title="No one on the board yet" body={current?.status === "Ended" ? "This competition had no public entrants." : "Join and be the first. Your rank updates as you trade."} />}
        {data && data.leaderboard.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13px]">
              <thead><tr className="text-[11px] text-dim">{["Rank", "Trader", "Country", "Return", "Equity", "Trades"].map((h) => <th key={h} className="px-5 py-2.5 text-left font-normal">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-line">
                {data.leaderboard.map((t) => (
                  <tr key={t.rank} className={cn("hover:bg-white/[0.02]", t.you && "bg-blue/[0.07]")}>
                    <td className="num px-5 py-3">{t.rank <= 3 ? ["🥇", "🥈", "🥉"][t.rank - 1] : `#${t.rank}`}</td>
                    <td className="px-5"><span className="font-medium">{t.name}</span> {t.you && <Badge tone="blue">You</Badge>}</td>
                    <td className="px-5 text-muted">{t.country || "—"}</td>
                    <td className={cn("num px-5", t.returnPct >= 0 ? "text-up" : "text-down")}>{t.returnPct >= 0 ? "+" : ""}{t.returnPct}%</td>
                    <td className="num px-5">{usd(t.equity, 0)}</td>
                    <td className="num px-5 text-muted">{t.trades}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="border-t border-line px-5 py-3 text-[11px] text-dim">Only traders with a public profile appear. You can hide yourself in Profile → Preferences.</p>
      </Card>
    </div>
  );
}
