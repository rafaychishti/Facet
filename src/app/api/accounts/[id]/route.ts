import { ApiError, handle, ok, requireUser } from "@/lib/api";
import { valueAccounts } from "@/lib/engine/core";

/** One account: holdings at market, orders, recent fills, equity history and performance stats. */
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/accounts/[id]">) => {
  const { id } = await ctx.params;
  const { db } = await requireUser();
  const { data: acc } = await db.from("accounts").select("*").eq("id", id).maybeSingle(); // RLS: own rows only
  if (!acc) throw new ApiError(404, "Account not found.");
  const [[v], { data: orders }, { data: fills }, { data: snaps }] = await Promise.all([
    valueAccounts([acc]),
    db.from("orders").select("*").eq("account_id", id).order("created_at", { ascending: false }).limit(100),
    db.from("fills").select("*").eq("account_id", id).order("created_at", { ascending: false }).limit(500),
    db.from("equity_snapshots").select("day, equity, balance").eq("account_id", id).order("day").limit(400),
  ]);
  const closed = (fills ?? []).filter((f) => f.side === "sell");
  const wins = closed.filter((f) => f.realized_pnl > 0), losses = closed.filter((f) => f.realized_pnl < 0);
  const sum = (xs: { realized_pnl: number }[]) => xs.reduce((s, x) => s + Number(x.realized_pnl), 0);
  let peak = acc.starting_balance, maxDd = 0;
  for (const s of [...(snaps ?? []).map((x) => x.equity), v.equity]) { peak = Math.max(peak, s); maxDd = Math.max(maxDd, (peak - s) / peak); }
  const stats = {
    closedTrades: closed.length,
    winRate: closed.length ? (wins.length / closed.length) * 100 : null,
    profitFactor: losses.length ? sum(wins) / Math.abs(sum(losses)) : wins.length ? Infinity : null,
    avgWin: wins.length ? sum(wins) / wins.length : null,
    avgLoss: losses.length ? sum(losses) / losses.length : null,
    best: closed.length ? Math.max(...closed.map((f) => Number(f.realized_pnl))) : null,
    worst: closed.length ? Math.min(...closed.map((f) => Number(f.realized_pnl))) : null,
    realized: sum(closed),
    maxDrawdownPct: maxDd * 100,
  };
  return ok({
    account: { ...acc, equity: v.equity, invested: v.invested, pnl: v.equity - acc.starting_balance, pnlPct: ((v.equity - acc.starting_balance) / acc.starting_balance) * 100 },
    holdings: v.holdings, orders: orders ?? [], fills: (fills ?? []).slice(0, 100), snapshots: snaps ?? [], stats,
  });
});
