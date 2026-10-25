import { ApiError, handle, ok, requireUser } from "@/lib/api";
import { payoutStatus, valueAccounts } from "@/lib/engine/core";
import { evaluateChallenge } from "@/lib/engine/rules";

/** Everything the analytics page needs for one challenge. */
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/challenges/[id]">) => {
  const { id } = await ctx.params;
  const { db } = await requireUser();
  const { data: ch } = await db.from("challenges").select("*, plan:challenge_plans(*), account:accounts(*)").eq("id", id).maybeSingle();
  if (!ch) throw new ApiError(404, "Challenge not found.");
  const [[v], { data: snaps }, { data: fills }, { data: certs }, { data: payouts }] = await Promise.all([
    valueAccounts([ch.account]),
    db.from("equity_snapshots").select("day, equity, balance").eq("account_id", ch.account_id).gte("day", ch.phase_started_at.slice(0, 10)).order("day"),
    db.from("fills").select("*").eq("account_id", ch.account_id).order("created_at", { ascending: false }).limit(50),
    db.from("certificates").select("*").eq("challenge_id", id).order("issued_at"),
    db.from("sim_payouts").select("*").eq("challenge_id", id).order("created_at", { ascending: false }),
  ]);
  const equity = ch.status === "active" ? v.equity : (ch.account.last_equity ?? ch.account.cash);
  const p = ch.plan;
  const verdict = evaluateChallenge({
    phase: ch.phase, phaseStartBalance: ch.phase_start_balance, dayStartBalance: ch.day_start_balance, equity, tradingDays: ch.trading_days,
    plan: { profitTargetPct: p.profit_target_pct, phase2TargetPct: p.phase2_target_pct, maxDailyLossPct: p.max_daily_loss_pct, maxDrawdownPct: p.max_drawdown_pct, minDays: p.min_days },
  });
  const targetPct = ch.phase === 1 ? p.profit_target_pct : ch.phase === 2 ? p.phase2_target_pct : null;
  return ok({
    challenge: ch, equity, balance: v.balance, cash: ch.account.cash, holdings: v.holdings, verdict,
    targets: {
      targetPct, target: targetPct ? ch.phase_start_balance * (targetPct / 100) : null,
      dailyLimit: ch.phase_start_balance * (p.max_daily_loss_pct / 100),
      maxLoss: ch.phase_start_balance * (p.max_drawdown_pct / 100),
      minBalance: ch.phase_start_balance * (1 - p.max_drawdown_pct / 100),
    },
    snapshots: snaps ?? [], fills: fills ?? [], certificates: certs ?? [], payouts: payouts ?? [],
    payout: await payoutStatus(ch, ch.account.cash, v.holdings.length > 0),
  });
});
