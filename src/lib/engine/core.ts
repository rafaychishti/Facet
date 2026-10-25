/**
 * Facet trading engine. Runs on the server (route handlers and the worker),
 * always with the service-role client after the caller has been authorised.
 */
import { z } from "zod";
import { serverEnv } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getQuote, getQuotes } from "@/lib/market";
import { isAfterClose, isMarketOpen, tradingDayKey } from "@/lib/market/hours";
import { normalizeSymbol, SYMBOL_RE } from "@/lib/market/universe";
import { decideFill, evaluateChallenge, validateBracket, PAYOUT_INTERVAL_DAYS, SIM_PROFIT_SPLIT, type OrderLike } from "./rules";
import { notify } from "./notify";

export class EngineError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const db = () => supabaseAdmin();
const canFillNow = () => isMarketOpen() || serverEnv().allowExtendedFills;
const r2 = (n: number) => Math.round(n * 100) / 100;

type AccountRow = { id: string; user_id: string; kind: "paper" | "challenge" | "competition"; name: string; starting_balance: number; cash: number; status: string; last_equity: number | null };
type OrderRow = OrderLike & { id: string; account_id: string; user_id: string; symbol: string; qty: number; status: string; parent_id: string | null; take_profit: number | null; stop_loss: number | null; filled_price: number | null; reject_reason: string | null };
type PlanRow = { id: string; name: string; size: number; profit_target_pct: number; phase2_target_pct: number; max_daily_loss_pct: number; max_drawdown_pct: number; min_days: number; pro_only: boolean };
type ChallengeRow = {
  id: string; public_id: string; user_id: string; plan_id: string; account_id: string; phase: 1 | 2 | 3; status: string;
  phase_start_balance: number; day_start_balance: number; low_equity: number; best_day: number; worst_day: number;
  trading_days: number; last_trade_day: string | null; phase_started_at: string;
};

export async function isPro(userId: string) {
  const { data } = await db().from("subscriptions").select("status").eq("user_id", userId).maybeSingle();
  return data?.status === "trialing" || data?.status === "active";
}

async function ownAccount(userId: string, accountId: string): Promise<AccountRow> {
  const { data } = await db().from("accounts").select("*").eq("id", accountId).eq("user_id", userId).maybeSingle();
  if (!data) throw new EngineError(404, "Account not found.");
  return data as AccountRow;
}

/* ───────────────────────────── Orders ───────────────────────────── */

const num = z.coerce.number().finite().positive();
export const orderInput = z
  .object({
    accountId: z.string().uuid(),
    symbol: z.string().transform(normalizeSymbol).refine((s) => SYMBOL_RE.test(s), "Invalid symbol"),
    side: z.enum(["buy", "sell"]),
    type: z.enum(["market", "limit", "stop", "stop_limit"]),
    qty: z.coerce.number().int("Whole shares only").min(1).max(1_000_000),
    limitPrice: num.optional().nullable(),
    stopPrice: num.optional().nullable(),
    takeProfit: num.optional().nullable(),
    stopLoss: num.optional().nullable(),
  })
  .superRefine((o, ctx) => {
    if ((o.type === "limit" || o.type === "stop_limit") && !o.limitPrice) ctx.addIssue({ code: "custom", message: "Limit price is required." });
    if ((o.type === "stop" || o.type === "stop_limit") && !o.stopPrice) ctx.addIssue({ code: "custom", message: "Stop price is required." });
  });
export type OrderInput = z.infer<typeof orderInput>;

export async function placeOrder(userId: string, raw: unknown) {
  const parsed = orderInput.safeParse(raw);
  if (!parsed.success) throw new EngineError(400, parsed.error.issues[0]?.message ?? "Invalid order.");
  const o = parsed.data;
  const acc = await ownAccount(userId, o.accountId);
  if (acc.status !== "active") throw new EngineError(400, "This account is closed.");
  if (acc.kind === "challenge") {
    const { data: ch } = await db().from("challenges").select("status").eq("account_id", acc.id).single();
    if (ch?.status !== "active") throw new EngineError(400, "This challenge has ended.");
  }

  const quote = await getQuote(o.symbol);
  if (!quote) throw new EngineError(400, `No price available for ${o.symbol}.`);

  const ref = o.type === "limit" || o.type === "stop_limit" ? o.limitPrice! : o.type === "stop" ? o.stopPrice! : quote.price;
  const bracketErr = validateBracket({ side: o.side, refPrice: ref, takeProfit: o.takeProfit, stopLoss: o.stopLoss });
  if (bracketErr) throw new EngineError(400, bracketErr);

  if (o.side === "buy" && o.qty * ref > acc.cash) throw new EngineError(400, `Insufficient buying power (${o.qty} × ${ref.toFixed(2)} > ${acc.cash.toFixed(2)}).`);
  if (o.side === "sell") {
    const { data: pos } = await db().from("positions").select("qty").eq("account_id", acc.id).eq("symbol", o.symbol).maybeSingle();
    if (!pos || pos.qty < o.qty) throw new EngineError(400, `You hold ${pos?.qty ?? 0} ${o.symbol}. Short selling isn't supported.`);
  }

  const { data: inserted, error } = await db()
    .from("orders")
    .insert({
      account_id: acc.id, user_id: userId, symbol: o.symbol, side: o.side, type: o.type, qty: o.qty,
      limit_price: o.limitPrice ?? null, stop_price: o.stopPrice ?? null,
      take_profit: o.takeProfit ?? null, stop_loss: o.stopLoss ?? null,
    })
    .select("*")
    .single();
  if (error || !inserted) throw new EngineError(500, "Could not place the order.");
  const order = inserted as OrderRow;

  if (!canFillNow()) {
    return { order, message: o.type === "market" ? "Market is closed. Order queued for the next open." : "Order working. It will be checked when the market opens." };
  }
  const result = await tryFill(order, quote.price, { notifyUser: false });
  if (result?.status === "filled") return { order: result, message: `Filled ${o.side.toUpperCase()} ${o.qty} ${o.symbol} @ ${Number(result.filled_price).toFixed(2)}` };
  if (result?.status === "rejected") throw new EngineError(400, result.reject_reason ?? "Order rejected.");
  return { order: result ?? order, message: `${o.type.replace("_", "-")} order working` };
}

/** Attempt to fill one working order at `price`. Returns the updated order, or null if it should keep working. */
async function tryFill(order: OrderRow, price: number, opts: { notifyUser: boolean }): Promise<OrderRow | null> {
  const d = decideFill(order, price);
  if (!d.fill) {
    if (d.triggerStop) await db().from("orders").update({ stop_triggered: true }).eq("id", order.id);
    return null;
  }
  const { data, error } = await db().rpc("execute_fill", { p_order_id: order.id, p_price: r2(d.price) });
  if (error) throw new EngineError(500, `Fill failed: ${error.message}`);
  const filled = data as OrderRow;
  if (filled.status === "filled") {
    await afterFill(filled);
    if (opts.notifyUser) {
      await notify(filled.user_id, "ok", `${filled.type.replace("_", "-")} order filled: ${filled.side.toUpperCase()} ${filled.qty} ${filled.symbol} @ ${Number(filled.filled_price).toFixed(2)}`, "/portfolio", { kind: "fill" });
    }
  } else if (filled.status === "rejected" && opts.notifyUser) {
    await notify(filled.user_id, "error", `Order for ${filled.symbol} rejected: ${filled.reject_reason}`, "/portfolio");
  }
  return filled;
}

/** Bookkeeping after any fill: challenge trading days + an immediate rules check. */
async function afterFill(order: OrderRow) {
  const { data: ch } = await db().from("challenges").select("*").eq("account_id", order.account_id).eq("status", "active").maybeSingle();
  if (!ch) return;
  const today = tradingDayKey();
  if (ch.last_trade_day !== today) {
    await db().from("challenges").update({ trading_days: ch.trading_days + 1, last_trade_day: today }).eq("id", ch.id);
  }
  await evaluateChallenges([ch.id]);
}

export async function cancelOrder(userId: string, orderId: string) {
  const { data } = await db().from("orders").update({ status: "cancelled" }).eq("id", orderId).eq("user_id", userId).eq("status", "working").select("id").maybeSingle();
  if (!data) throw new EngineError(404, "Order not found or no longer working.");
  return { ok: true };
}

export async function closePosition(userId: string, accountId: string, symbol: string) {
  const s = normalizeSymbol(symbol);
  await ownAccount(userId, accountId);
  const { data: pos } = await db().from("positions").select("qty").eq("account_id", accountId).eq("symbol", s).maybeSingle();
  if (!pos) throw new EngineError(404, "No open position.");
  // free up the shares held by protective orders first
  await db().from("orders").update({ status: "cancelled" }).eq("account_id", accountId).eq("symbol", s).eq("side", "sell").eq("status", "working");
  return placeOrder(userId, { accountId, symbol: s, side: "sell", type: "market", qty: pos.qty });
}

export async function resetAccount(userId: string, accountId: string) {
  const acc = await ownAccount(userId, accountId);
  if (acc.kind !== "paper") throw new EngineError(400, "Only paper accounts can be reset.");
  const { error } = await db().rpc("reset_account", { p_account_id: accountId });
  if (error) throw new EngineError(500, error.message);
  return { ok: true };
}

/** Match every working order against current prices. Called by the worker. */
export async function matchWorkingOrders() {
  if (!canFillNow()) return { checked: 0, filled: 0 };
  const { data: orders } = await db().from("orders").select("*").eq("status", "working").order("created_at").limit(2000);
  if (!orders?.length) return { checked: 0, filled: 0 };
  const quotes = new Map((await getQuotes([...new Set(orders.map((o) => o.symbol))])).map((q) => [q.symbol, q.price]));
  let filled = 0;
  for (const o of orders as OrderRow[]) {
    const price = quotes.get(o.symbol);
    if (!price) continue;
    try {
      const r = await tryFill(o, price, { notifyUser: true });
      if (r?.status === "filled") filled++;
    } catch (e) {
      console.error("[engine] fill error", o.id, e);
    }
  }
  return { checked: orders.length, filled };
}

/* ───────────────────────────── Equity ───────────────────────────── */

export type Holding = { symbol: string; qty: number; avg_price: number; price: number; value: number; pnl: number; pnlPct: number; dayChangePct: number };

export async function valueAccounts(accounts: { id: string; cash: number }[]) {
  const ids = accounts.map((a) => a.id);
  const { data: positions } = ids.length ? await db().from("positions").select("*").in("account_id", ids) : { data: [] };
  const quotes = new Map((await getQuotes([...new Set((positions ?? []).map((p) => p.symbol))])).map((q) => [q.symbol, q]));
  return accounts.map((a) => {
    const holdings: Holding[] = (positions ?? [])
      .filter((p) => p.account_id === a.id)
      .map((p) => {
        const q = quotes.get(p.symbol);
        const price = q?.price ?? p.avg_price;
        return { symbol: p.symbol, qty: p.qty, avg_price: p.avg_price, price, value: r2(price * p.qty), pnl: r2((price - p.avg_price) * p.qty), pnlPct: ((price - p.avg_price) / p.avg_price) * 100, dayChangePct: q?.changePct ?? 0 };
      });
    const invested = holdings.reduce((s, h) => s + h.value, 0);
    const costBasis = holdings.reduce((s, h) => s + h.avg_price * h.qty, 0);
    return { id: a.id, cash: a.cash, holdings, invested: r2(invested), equity: r2(a.cash + invested), balance: r2(a.cash + costBasis) };
  });
}

export async function refreshEquity() {
  const { data: accounts } = await db().from("accounts").select("id, cash").eq("status", "active").limit(5000);
  if (!accounts?.length) return 0;
  const valued = await valueAccounts(accounts as { id: string; cash: number }[]);
  const now = new Date().toISOString();
  await Promise.all(valued.map((v) => db().from("accounts").update({ last_equity: v.equity, last_equity_at: now }).eq("id", v.id)));
  return valued.length;
}

/* ───────────────────────────── Challenges ───────────────────────────── */

export async function startChallenge(userId: string, planId: string) {
  const { data: plan } = await db().from("challenge_plans").select("*").eq("id", planId).maybeSingle();
  if (!plan) throw new EngineError(404, "Unknown challenge plan.");
  const p = plan as PlanRow;
  if (p.pro_only && !(await isPro(userId))) throw new EngineError(402, `The ${p.name} challenge needs Facet Pro. Start a free trial from Billing.`);
  const { count } = await db().from("challenges").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "active");
  if ((count ?? 0) >= 3) throw new EngineError(400, "You can run up to 3 challenges at once.");

  const { data: acc, error } = await db().from("accounts").insert({ user_id: userId, kind: "challenge", name: `${p.name} challenge`, starting_balance: p.size, cash: p.size, last_equity: p.size }).select("id").single();
  if (error || !acc) throw new EngineError(500, "Could not create the challenge account.");
  const { data: ch, error: e2 } = await db()
    .from("challenges")
    .insert({ user_id: userId, plan_id: p.id, account_id: acc.id, phase_start_balance: p.size, day_start_balance: p.size, low_equity: p.size })
    .select("*")
    .single();
  if (e2 || !ch) throw new EngineError(500, "Could not start the challenge.");
  await notify(userId, "info", `${p.name} challenge ${ch.public_id} started. Reach +${p.profit_target_pct}% without breaking the loss limits.`, `/challenges/${ch.id}`);
  return ch as ChallengeRow;
}

const warned = new Set<string>(); // challengeId:day, to avoid repeating warnings

export async function evaluateChallenges(ids?: string[]) {
  let q = db().from("challenges").select("*, plan:challenge_plans(*), account:accounts(id, cash)").eq("status", "active");
  if (ids?.length) q = q.in("id", ids);
  const { data } = await q.limit(5000);
  if (!data?.length) return { evaluated: 0 };
  const rows = data as (ChallengeRow & { plan: PlanRow; account: { id: string; cash: number } })[];
  const valued = new Map((await valueAccounts(rows.map((r) => r.account))).map((v) => [v.id, v]));
  const today = tradingDayKey();

  for (const ch of rows) {
    const v = valued.get(ch.account_id)!;
    const equity = v.equity;
    if (equity < ch.low_equity) await db().from("challenges").update({ low_equity: equity }).eq("id", ch.id);
    const verdict = evaluateChallenge({
      phase: ch.phase, phaseStartBalance: ch.phase_start_balance, dayStartBalance: ch.day_start_balance, equity, tradingDays: ch.trading_days,
      plan: { profitTargetPct: ch.plan.profit_target_pct, phase2TargetPct: ch.plan.phase2_target_pct, maxDailyLossPct: ch.plan.max_daily_loss_pct, maxDrawdownPct: ch.plan.max_drawdown_pct, minDays: ch.plan.min_days },
    });

    if (verdict.result === "fail") {
      await db().from("challenges").update({ status: "failed", fail_reason: verdict.reason, ended_at: new Date().toISOString(), low_equity: Math.min(equity, ch.low_equity) }).eq("id", ch.id);
      await db().from("orders").update({ status: "cancelled" }).eq("account_id", ch.account_id).eq("status", "working");
      await db().from("accounts").update({ status: "closed", last_equity: equity }).eq("id", ch.account_id);
      await notify(ch.user_id, "error", `Challenge ${ch.public_id} ended: ${verdict.reason}.`, `/challenges/${ch.id}`, { email: true, subject: "Your Facet challenge has ended" });
    } else if (verdict.result === "pass_phase") {
      await advancePhase(ch);
    } else if (verdict.warn && !warned.has(`${ch.id}:${today}`)) {
      warned.add(`${ch.id}:${today}`);
      await notify(ch.user_id, "warn", `Challenge ${ch.public_id}: you've used ${Math.round(Math.max(verdict.dailyLossUsedPct, verdict.drawdownUsedPct))}% of a loss limit.`, `/challenges/${ch.id}`, { kind: "rule" });
    }
  }
  return { evaluated: rows.length };
}

async function advancePhase(ch: ChallengeRow & { plan: PlanRow }) {
  const { data: prof } = await db().from("profiles").select("full_name").eq("id", ch.user_id).single();
  const holder = prof?.full_name || "Facet trader";
  const sizeLabel = `${ch.plan.name} · $${(ch.plan.size / 1000).toFixed(0)}K`;
  if (ch.phase === 1) {
    await db().rpc("reset_account", { p_account_id: ch.account_id });
    await db().from("challenges").update({
      phase: 2, phase_start_balance: ch.plan.size, day_start_balance: ch.plan.size, low_equity: ch.plan.size,
      trading_days: 0, last_trade_day: null, best_day: 0, worst_day: 0, phase_started_at: new Date().toISOString(),
    }).eq("id", ch.id);
    await db().from("certificates").insert({ user_id: ch.user_id, challenge_id: ch.id, title: "Phase 1 Passed", detail: sizeLabel, holder_name: holder });
    await notify(ch.user_id, "ok", `Phase 1 passed on ${ch.public_id}! Phase 2 has started with a fresh ${ch.plan.size.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })} balance.`, `/challenges/${ch.id}`, { email: true, subject: "Phase 1 passed 🎉" });
  } else if (ch.phase === 2) {
    await db().rpc("reset_account", { p_account_id: ch.account_id });
    await db().from("challenges").update({
      phase: 3, phase_start_balance: ch.plan.size, day_start_balance: ch.plan.size, low_equity: ch.plan.size,
      trading_days: 0, last_trade_day: null, best_day: 0, worst_day: 0, phase_started_at: new Date().toISOString(),
    }).eq("id", ch.id);
    await db().from("certificates").insert({ user_id: ch.user_id, challenge_id: ch.id, title: "Challenge Passed", detail: sizeLabel, holder_name: holder });
    await notify(ch.user_id, "ok", `You passed the ${ch.plan.name} challenge! Your simulated funded account is live.`, `/challenges/${ch.id}`, { email: true, subject: "Challenge passed 🏆" });
  }
}

export async function payoutStatus(ch: ChallengeRow, cash: number, hasPositions: boolean) {
  const profit = r2(cash - ch.phase_start_balance);
  const { data: last } = await db().from("sim_payouts").select("created_at").eq("challenge_id", ch.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const since = new Date(last?.created_at ?? ch.phase_started_at).getTime();
  const nextEligibleAt = new Date(since + PAYOUT_INTERVAL_DAYS * 86400000);
  const reasons: string[] = [];
  if (ch.phase !== 3 || ch.status !== "active") reasons.push("Payouts unlock in the funded stage.");
  if (profit <= 0) reasons.push("No closed profit to pay out yet.");
  if (hasPositions) reasons.push("Close all positions first.");
  if (Date.now() < nextEligibleAt.getTime()) reasons.push(`Next payout window opens ${nextEligibleAt.toDateString()}.`);
  return { profit: Math.max(0, profit), amount: r2(Math.max(0, profit) * SIM_PROFIT_SPLIT), eligible: reasons.length === 0, reasons, nextEligibleAt: nextEligibleAt.toISOString() };
}

export async function requestPayout(userId: string, challengeId: string) {
  const { data: ch } = await db().from("challenges").select("*").eq("id", challengeId).eq("user_id", userId).maybeSingle();
  if (!ch) throw new EngineError(404, "Challenge not found.");
  const { data: acc } = await db().from("accounts").select("cash").eq("id", ch.account_id).single();
  const { count } = await db().from("positions").select("symbol", { count: "exact", head: true }).eq("account_id", ch.account_id);
  const status = await payoutStatus(ch as ChallengeRow, acc!.cash, (count ?? 0) > 0);
  if (!status.eligible) throw new EngineError(400, status.reasons[0]);
  await db().from("sim_payouts").insert({ user_id: userId, challenge_id: challengeId, amount: status.amount });
  // the profit leaves the simulated account, like a real withdrawal
  await db().from("accounts").update({ cash: ch.phase_start_balance }).eq("id", ch.account_id);
  await notify(userId, "ok", `Simulated payout of $${status.amount.toFixed(2)} recorded for ${ch.public_id}.`, "/payouts");
  return status;
}

/* ───────────────────────────── Competitions ───────────────────────────── */

export async function joinCompetition(userId: string, competitionId: string) {
  const { data: c } = await db().from("competitions").select("*").eq("id", competitionId).maybeSingle();
  if (!c) throw new EngineError(404, "Competition not found.");
  if (new Date(c.ends_at).getTime() < Date.now()) throw new EngineError(400, "This competition has ended.");
  if (c.pro_only && !(await isPro(userId))) throw new EngineError(402, "This competition is for Pro members.");
  const { data: existing } = await db().from("competition_entries").select("account_id").eq("competition_id", c.id).eq("user_id", userId).maybeSingle();
  if (existing) return existing;
  const { data: acc } = await db().from("accounts").insert({ user_id: userId, kind: "competition", name: c.name, starting_balance: c.size, cash: c.size, last_equity: c.size }).select("id").single();
  await db().from("competition_entries").insert({ competition_id: c.id, user_id: userId, account_id: acc!.id });
  await notify(userId, "info", `You joined ${c.name}. Trade from the terminal using the "${c.name}" account.`, "/terminal");
  return { account_id: acc!.id };
}

/* ───────────────────────────── Alerts ───────────────────────────── */

export async function evaluateAlerts() {
  const { data: alerts } = await db().from("alerts").select("*").eq("status", "active").limit(5000);
  if (!alerts?.length) return { checked: 0, triggered: 0 };
  const quotes = new Map((await getQuotes([...new Set(alerts.map((a) => a.symbol))])).map((q) => [q.symbol, q]));
  let triggered = 0;
  for (const a of alerts) {
    const q = quotes.get(a.symbol);
    if (!q) continue;
    const hit =
      (a.condition === "price_above" && q.price >= a.value) ||
      (a.condition === "price_below" && q.price <= a.value) ||
      (a.condition === "pct_change_above" && q.changePct >= a.value) ||
      (a.condition === "pct_change_below" && q.changePct <= -Math.abs(a.value));
    if (!hit) continue;
    const { data: upd } = await db().from("alerts").update({ status: "triggered", triggered_at: new Date().toISOString() }).eq("id", a.id).eq("status", "active").select("id").maybeSingle();
    if (!upd) continue; // someone else got it first
    triggered++;
    const label = { price_above: "rose above", price_below: "fell below", pct_change_above: "is up more than", pct_change_below: "is down more than" }[a.condition as string];
    const unit = a.condition.startsWith("pct") ? "%" : "";
    await notify(a.user_id, "info", `${a.symbol} ${label} ${a.value}${unit} (now ${q.price.toFixed(2)}, ${q.changePct >= 0 ? "+" : ""}${q.changePct.toFixed(2)}%).`, `/symbol/${a.symbol}`, { email: a.notify_email, subject: `Facet alert: ${a.symbol}`, kind: "alert" });
  }
  return { checked: alerts.length, triggered };
}

/* ───────────────────────────── End of day ───────────────────────────── */

/** Runs once per trading day after the 4 PM ET close (idempotent). */
export async function runEndOfDay(force = false) {
  if (!force && !isAfterClose()) return { snapshots: 0 };
  const day = tradingDayKey();
  const { data: accounts } = await db().from("accounts").select("id, cash").eq("status", "active").limit(5000);
  if (!accounts?.length) return { snapshots: 0 };
  const valued = await valueAccounts(accounts as { id: string; cash: number }[]);
  const { data: inserted } = await db()
    .from("equity_snapshots")
    .upsert(valued.map((v) => ({ account_id: v.id, day, balance: v.balance, equity: v.equity })), { onConflict: "account_id,day", ignoreDuplicates: true })
    .select("account_id, equity");
  const done = new Map((inserted ?? []).map((r) => [r.account_id, r.equity as number]));
  if (done.size) {
    const { data: chs } = await db().from("challenges").select("*").eq("status", "active").in("account_id", [...done.keys()]);
    for (const ch of (chs ?? []) as ChallengeRow[]) {
      const equity = done.get(ch.account_id)!;
      const dayPnl = r2(equity - ch.day_start_balance);
      await db().from("challenges").update({
        day_start_balance: equity, best_day: Math.max(ch.best_day, dayPnl), worst_day: Math.min(ch.worst_day, dayPnl),
      }).eq("id", ch.id);
    }
  }
  return { snapshots: done.size };
}

/** One full engine cycle. The worker calls this every ~20 seconds. */
export async function runTick() {
  const started = Date.now();
  const matched = await matchWorkingOrders();
  const challenges = await evaluateChallenges();
  const alerts = await evaluateAlerts();
  const equity = await refreshEquity();
  const eod = await runEndOfDay();
  return { ms: Date.now() - started, matched, challenges, alerts, equity, eod };
}
