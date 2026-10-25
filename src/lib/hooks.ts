"use client";

import useSWR, { mutate as globalMutate } from "swr";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { Candle, NewsItem, Profile, Quote, SearchResult, Timeframe } from "@/lib/market/types";

export class FetchError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "same-origin" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new FetchError(res.status, body.error ?? `Request failed (${res.status})`);
  return body as T;
}

/** Call a mutating API route. Throws FetchError with the server's message. */
export async function api<T = unknown>(method: "POST" | "PATCH" | "DELETE", url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method, credentials: "same-origin",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new FetchError(res.status, data.error ?? `Request failed (${res.status})`);
  return data as T;
}

/** Revalidate every cached key that starts with one of the prefixes. */
export const refresh = (...prefixes: string[]) =>
  globalMutate((key) => typeof key === "string" && prefixes.some((p) => key.startsWith(p)));

/* ── Market ── */
export type MarketState = { open: boolean; label: string };

export function useQuotes(symbols: string[], refreshMs = 15_000) {
  const key = symbols.length ? `/api/market/quotes?symbols=${[...new Set(symbols)].join(",")}` : null;
  const r = useSWR<{ quotes: Quote[]; source: "live" | "demo"; market: MarketState }>(key, fetcher, { refreshInterval: refreshMs, keepPreviousData: true });
  const map = new Map((r.data?.quotes ?? []).map((q) => [q.symbol, q]));
  return { ...r, quotes: r.data?.quotes ?? [], map, source: r.data?.source, market: r.data?.market };
}

export const useQuote = (symbol: string) => {
  const r = useQuotes([symbol]);
  return { ...r, quote: r.map.get(symbol) };
};

export const useCandles = (symbol: string, tf: Timeframe) =>
  useSWR<{ candles: Candle[]; source: "live" | "demo" }>(`/api/market/candles?symbol=${symbol}&tf=${tf}`, fetcher, { keepPreviousData: true, refreshInterval: ["1m", "5m"].includes(tf) ? 30_000 : 0 });

export const useNews = (symbol?: string) =>
  useSWR<{ news: NewsItem[]; source: string }>(`/api/market/news${symbol ? `?symbol=${symbol}` : ""}`, fetcher);

export const useProfile = (symbol: string) => useSWR<{ profile: Profile }>(`/api/market/profile?symbol=${symbol}`, fetcher);

export type ScreenerRow = { symbol: string; name: string; sector: string; exchange: string; marketCap: number; pe: number; quote: Quote | null };
export const useScreener = () => useSWR<{ rows: ScreenerRow[]; source: string }>("/api/market/screener", fetcher, { refreshInterval: 30_000 });

export function useSearch(q: string) {
  const [debounced, setDebounced] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 200);
    return () => clearTimeout(t);
  }, [q]);
  return useSWR<{ results: SearchResult[] }>(debounced.trim() ? `/api/market/search?q=${encodeURIComponent(debounced.trim())}` : null, fetcher, { keepPreviousData: true });
}

/* ── User ── */
export type Notification = { id: number; tone: "info" | "ok" | "warn" | "error"; text: string; link: string | null; read_at: string | null; created_at: string };
export type Me = {
  id: string; email: string;
  profile: { full_name: string; handle: string | null; country: string; public_profile: boolean; language: string; notify_fills: boolean; notify_alerts_email: boolean; notify_rule_warnings: boolean; created_at: string };
  subscription: { status: string; trial_end: string | null; current_period_end: string | null; cancel_at_period_end: boolean; interval: string | null } | null;
  plan: "free" | "pro"; trialDaysLeft: number | null; notifications: Notification[]; unread: number;
};
export const useMe = () => useSWR<Me>("/api/me", fetcher, { refreshInterval: 30_000 });

export type Account = {
  id: string; kind: "paper" | "challenge" | "competition"; name: string; starting_balance: number; cash: number; status: string;
  equity: number; invested: number; pnl: number; pnlPct: number; positions: number;
};
export const useAccounts = () => useSWR<{ accounts: Account[] }>("/api/accounts", fetcher, { refreshInterval: 15_000 });

export type Holding = { symbol: string; qty: number; avg_price: number; price: number; value: number; pnl: number; pnlPct: number; dayChangePct: number };
export type Order = {
  id: string; symbol: string; side: "buy" | "sell"; type: "market" | "limit" | "stop" | "stop_limit"; qty: number; limit_price: number | null; stop_price: number | null;
  take_profit: number | null; stop_loss: number | null; parent_id: string | null; status: "working" | "filled" | "cancelled" | "rejected";
  filled_price: number | null; filled_at: string | null; reject_reason: string | null; created_at: string;
};
export type Fill = { id: number; symbol: string; side: string; qty: number; price: number; realized_pnl: number; created_at: string };
export type AccountDetail = {
  account: Account & { pnl: number; pnlPct: number };
  holdings: Holding[]; orders: Order[]; fills: Fill[]; snapshots: { day: string; equity: number; balance: number }[];
  stats: { closedTrades: number; winRate: number | null; profitFactor: number | null; avgWin: number | null; avgLoss: number | null; best: number | null; worst: number | null; realized: number; maxDrawdownPct: number };
};
export const useAccount = (id?: string | null) => useSWR<AccountDetail>(id ? `/api/accounts/${id}` : null, fetcher, { refreshInterval: 10_000, keepPreviousData: true });

const readAccount = () => {
  try {
    return localStorage.getItem("facet:account");
  } catch {
    return null;
  }
};
const subscribeAccount = (cb: () => void) => {
  window.addEventListener("facet:account", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("facet:account", cb);
    window.removeEventListener("storage", cb);
  };
};

/** Read a URL query parameter in a client component without a Suspense boundary. */
export function useSearchParam(name: string) {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener("popstate", cb);
      return () => window.removeEventListener("popstate", cb);
    },
    () => new URLSearchParams(window.location.search).get(name),
    () => null,
  );
}

/** The account the terminal trades on, remembered per browser. */
export function useActiveAccount() {
  const { data, ...rest } = useAccounts();
  const selected = useSyncExternalStore(subscribeAccount, readAccount, () => null);
  const active = data?.accounts.filter((a) => a.status === "active") ?? [];
  const account = active.find((a) => a.id === selected) ?? active.find((a) => a.kind === "paper") ?? active[0];
  const choose = useCallback((id: string) => {
    try {
      localStorage.setItem("facet:account", id);
    } catch {}
    window.dispatchEvent(new Event("facet:account"));
  }, []);
  return { ...rest, accounts: active, account, choose };
}

export const useWatchlist = () => useSWR<{ id: string; name: string; symbols: string[] }>("/api/watchlist", fetcher);

export type Alert = { id: string; symbol: string; condition: "price_above" | "price_below" | "pct_change_above" | "pct_change_below"; value: number; status: "active" | "triggered" | "paused"; notify_email: boolean; triggered_at: string | null; created_at: string };
export const useAlerts = () => useSWR<{ alerts: Alert[]; limit: number | null }>("/api/alerts", fetcher, { refreshInterval: 20_000 });

export type Plan = { id: string; name: string; size: number; profit_target_pct: number; phase2_target_pct: number; max_daily_loss_pct: number; max_drawdown_pct: number; min_days: number; pro_only: boolean };
export type ChallengeSummary = {
  id: string; public_id: string; plan_id: string; account_id: string; phase: 1 | 2 | 3; status: "active" | "passed" | "failed";
  phase_start_balance: number; day_start_balance: number; trading_days: number; fail_reason: string | null; started_at: string; ended_at: string | null; equity: number;
  plan: { name: string; size: number; profit_target_pct: number; phase2_target_pct: number; min_days: number };
};
export const useChallenges = () => useSWR<{ pro: boolean; plans: Plan[]; challenges: ChallengeSummary[] }>("/api/challenges", fetcher, { refreshInterval: 20_000 });

export type ChallengeDetail = {
  challenge: ChallengeSummary & { low_equity: number; best_day: number; worst_day: number; last_trade_day: string | null; phase_started_at: string; plan: Plan; account: { id: string; cash: number; status: string } };
  equity: number; balance: number; cash: number; holdings: Holding[];
  verdict: { result: "ok"; dailyLossUsedPct: number; drawdownUsedPct: number; warn: boolean } | { result: "fail"; reason: string } | { result: "pass_phase" };
  targets: { targetPct: number | null; target: number | null; dailyLimit: number; maxLoss: number; minBalance: number };
  snapshots: { day: string; equity: number; balance: number }[]; fills: Fill[];
  certificates: Certificate[]; payouts: Payout[];
  payout: { profit: number; amount: number; eligible: boolean; reasons: string[]; nextEligibleAt: string };
};
export const useChallenge = (id?: string | null) => useSWR<ChallengeDetail>(id ? `/api/challenges/${id}` : null, fetcher, { refreshInterval: 15_000, keepPreviousData: true });

export type Competition = { id: string; name: string; starts_at: string; ends_at: string; size: number; prize: string; pro_only: boolean; status: "Live" | "Upcoming" | "Ended"; joined: boolean };
export type BoardRow = { rank: number; name: string; handle: string | null; country: string; equity: number; returnPct: number; trades: number; you: boolean };
export const useCompetitions = (id?: string | null) =>
  useSWR<{ competitions: Competition[]; selected: string; entrants: number; leaderboard: BoardRow[] }>(`/api/competitions${id ? `?id=${id}` : ""}`, fetcher, { refreshInterval: 30_000, keepPreviousData: true });

export type Certificate = { id: string; code: string; title: string; detail: string; holder_name: string; issued_at: string };
export const useCertificates = () => useSWR<{ certificates: Certificate[] }>("/api/certificates", fetcher);

export type Payout = { id: string; code: string; amount: number; created_at: string; challenge?: { public_id: string } };
export const usePayouts = () => useSWR<{ payouts: Payout[]; funded: (ChallengeDetail["payout"] & { challengeId: string; publicId: string })[] }>("/api/payouts", fetcher);

export const useAffiliate = () => useSWR<{ application: { status: string; ref_code: string | null; created_at: string } | null }>("/api/affiliate", fetcher);
