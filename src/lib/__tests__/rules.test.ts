import { describe, expect, it } from "vitest";
import { decideFill, evaluateChallenge, validateBracket } from "@/lib/engine/rules";

const order = (o: Partial<Parameters<typeof decideFill>[0]>) => ({ side: "buy" as const, type: "market" as const, limit_price: null, stop_price: null, stop_triggered: false, ...o });

describe("decideFill", () => {
  it("fills market orders at the current price", () => {
    expect(decideFill(order({}), 101.5)).toEqual({ fill: true, price: 101.5 });
  });
  it("buy limit fills at or below the limit only", () => {
    expect(decideFill(order({ type: "limit", limit_price: 100 }), 100.01).fill).toBe(false);
    expect(decideFill(order({ type: "limit", limit_price: 100 }), 99.5)).toEqual({ fill: true, price: 99.5 });
  });
  it("sell limit fills at or above the limit only", () => {
    expect(decideFill(order({ side: "sell", type: "limit", limit_price: 100 }), 99).fill).toBe(false);
    expect(decideFill(order({ side: "sell", type: "limit", limit_price: 100 }), 100)).toEqual({ fill: true, price: 100 });
  });
  it("sell stop triggers at or below the stop", () => {
    expect(decideFill(order({ side: "sell", type: "stop", stop_price: 95 }), 96).fill).toBe(false);
    expect(decideFill(order({ side: "sell", type: "stop", stop_price: 95 }), 94.9)).toEqual({ fill: true, price: 94.9 });
  });
  it("buy stop triggers at or above the stop", () => {
    expect(decideFill(order({ type: "stop", stop_price: 110 }), 110.2)).toEqual({ fill: true, price: 110.2 });
  });
  it("stop-limit: triggers first, then behaves like a limit", () => {
    const o = order({ side: "buy", type: "stop_limit", stop_price: 105, limit_price: 106 });
    expect(decideFill(o, 104)).toEqual({ fill: false });
    expect(decideFill(o, 107)).toEqual({ fill: false, triggerStop: true }); // triggered but above limit
    expect(decideFill({ ...o, stop_triggered: true }, 105.5)).toEqual({ fill: true, price: 105.5 });
  });
  it("never fills on a bad price", () => {
    expect(decideFill(order({}), 0).fill).toBe(false);
    expect(decideFill(order({}), NaN).fill).toBe(false);
  });
});

const plan = { profitTargetPct: 10, phase2TargetPct: 5, maxDailyLossPct: 5, maxDrawdownPct: 10, minDays: 5 };
const base = { phase: 1 as const, phaseStartBalance: 100_000, dayStartBalance: 100_000, equity: 100_000, tradingDays: 0, plan };

describe("evaluateChallenge", () => {
  it("is ok at the start", () => {
    expect(evaluateChallenge(base)).toMatchObject({ result: "ok", warn: false });
  });
  it("fails on the daily loss limit (5% of phase balance below today's start)", () => {
    expect(evaluateChallenge({ ...base, dayStartBalance: 103_000, equity: 98_000 })).toMatchObject({ result: "fail" });
    expect(evaluateChallenge({ ...base, dayStartBalance: 103_000, equity: 98_100 }).result).toBe("ok");
  });
  it("fails on max drawdown even if the daily loss is small", () => {
    expect(evaluateChallenge({ ...base, dayStartBalance: 91_000, equity: 90_000 })).toMatchObject({ result: "fail", reason: expect.stringContaining("drawdown") });
  });
  it("needs both the target and the minimum trading days to pass", () => {
    expect(evaluateChallenge({ ...base, equity: 110_000, dayStartBalance: 110_000, tradingDays: 4 }).result).toBe("ok");
    expect(evaluateChallenge({ ...base, equity: 110_000, dayStartBalance: 110_000, tradingDays: 5 }).result).toBe("pass_phase");
  });
  it("uses the lower phase 2 target", () => {
    expect(evaluateChallenge({ ...base, phase: 2, equity: 105_000, dayStartBalance: 105_000, tradingDays: 5 }).result).toBe("pass_phase");
  });
  it("funded stage (phase 3) never 'passes', only fails", () => {
    expect(evaluateChallenge({ ...base, phase: 3, equity: 150_000, dayStartBalance: 150_000, tradingDays: 50 }).result).toBe("ok");
  });
  it("warns at 75% of a limit", () => {
    expect(evaluateChallenge({ ...base, equity: 96_200 })).toMatchObject({ result: "ok", warn: true });
  });
});

describe("validateBracket", () => {
  it("rejects TP below entry and SL above entry", () => {
    expect(validateBracket({ side: "buy", refPrice: 100, takeProfit: 99 })).toMatch(/above/);
    expect(validateBracket({ side: "buy", refPrice: 100, stopLoss: 101 })).toMatch(/below/);
    expect(validateBracket({ side: "buy", refPrice: 100, takeProfit: 110, stopLoss: 95 })).toBeNull();
  });
  it("only allows brackets on buys", () => {
    expect(validateBracket({ side: "sell", refPrice: 100, takeProfit: 90 })).toMatch(/buy orders/);
  });
});
