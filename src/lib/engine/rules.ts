/**
 * Pure trading logic, with no database access, so it can be unit tested.
 */

export type OrderLike = {
  side: "buy" | "sell";
  type: "market" | "limit" | "stop" | "stop_limit";
  limit_price: number | null;
  stop_price: number | null;
  stop_triggered: boolean;
};

export type FillDecision = { fill: false; triggerStop?: boolean } | { fill: true; price: number };

/**
 * Decide whether a working order should fill at the current price.
 * Fills happen at the current market price when the condition is met
 * (a marketable limit can only improve on the limit, never worsen it).
 */
export function decideFill(o: OrderLike, price: number): FillDecision {
  if (!(price > 0)) return { fill: false };
  switch (o.type) {
    case "market":
      return { fill: true, price };
    case "limit":
      if (o.side === "buy" && price <= (o.limit_price ?? 0)) return { fill: true, price };
      if (o.side === "sell" && price >= (o.limit_price ?? Infinity)) return { fill: true, price };
      return { fill: false };
    case "stop":
      if (o.side === "buy" && price >= (o.stop_price ?? Infinity)) return { fill: true, price };
      if (o.side === "sell" && price <= (o.stop_price ?? 0)) return { fill: true, price };
      return { fill: false };
    case "stop_limit": {
      const triggered =
        o.stop_triggered ||
        (o.side === "buy" ? price >= (o.stop_price ?? Infinity) : price <= (o.stop_price ?? 0));
      if (!triggered) return { fill: false };
      const asLimit = decideFill({ ...o, type: "limit" }, price);
      return asLimit.fill ? asLimit : { fill: false, triggerStop: !o.stop_triggered };
    }
  }
}

export type ChallengeState = {
  phase: 1 | 2 | 3;
  phaseStartBalance: number;
  dayStartBalance: number;
  equity: number;
  tradingDays: number;
  plan: { profitTargetPct: number; phase2TargetPct: number; maxDailyLossPct: number; maxDrawdownPct: number; minDays: number };
};

export type ChallengeVerdict =
  | { result: "ok"; dailyLossUsedPct: number; drawdownUsedPct: number; warn: boolean }
  | { result: "fail"; reason: string }
  | { result: "pass_phase" };

/**
 * Rules (static, like most prop-firm challenges):
 *  - Daily loss: equity may not fall more than maxDailyLossPct × phase start balance
 *    below today's starting balance (reset at the 4 PM ET close).
 *  - Max drawdown: equity may not fall below phase start × (1 − maxDrawdownPct).
 *  - Pass: equity ≥ target AND minimum trading days reached. Phase 3 (simulated
 *    funded stage) has no target.
 */
export function evaluateChallenge(s: ChallengeState): ChallengeVerdict {
  const cents = (n: number) => Math.round(n * 100) / 100;
  const dailyLimit = cents(s.phaseStartBalance * (s.plan.maxDailyLossPct / 100));
  const floor = cents(s.phaseStartBalance * (1 - s.plan.maxDrawdownPct / 100));
  const dailyLoss = Math.max(0, s.dayStartBalance - s.equity);

  if (dailyLoss >= dailyLimit) return { result: "fail", reason: `Daily loss limit of ${s.plan.maxDailyLossPct}% was breached` };
  if (s.equity <= floor) return { result: "fail", reason: `Maximum drawdown of ${s.plan.maxDrawdownPct}% was breached` };

  if (s.phase < 3) {
    const targetPct = s.phase === 1 ? s.plan.profitTargetPct : s.plan.phase2TargetPct;
    const target = Math.round(s.phaseStartBalance * (1 + targetPct / 100) * 100) / 100; // cents, avoids float drift
    if (s.equity >= target && s.tradingDays >= s.plan.minDays) return { result: "pass_phase" };
  }

  const dailyLossUsedPct = (dailyLoss / dailyLimit) * 100;
  const drawdownUsedPct = (Math.max(0, s.phaseStartBalance - s.equity) / (s.phaseStartBalance - floor)) * 100;
  return { result: "ok", dailyLossUsedPct, drawdownUsedPct, warn: dailyLossUsedPct >= 75 || drawdownUsedPct >= 75 };
}

export type BracketInput = { side: "buy" | "sell"; refPrice: number; takeProfit?: number | null; stopLoss?: number | null };

/** Returns an error message if bracket prices don't make sense, else null. */
export function validateBracket(b: BracketInput): string | null {
  if (b.side === "sell" && (b.takeProfit || b.stopLoss)) return "Take-profit / stop-loss can only be attached to buy orders.";
  if (b.takeProfit != null && b.takeProfit <= b.refPrice) return "Take-profit must be above the entry price.";
  if (b.stopLoss != null && b.stopLoss >= b.refPrice) return "Stop-loss must be below the entry price.";
  return null;
}

export const SIM_PROFIT_SPLIT = 0.8;
export const PAYOUT_INTERVAL_DAYS = 14;
