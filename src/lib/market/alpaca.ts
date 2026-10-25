/**
 * Alpaca Market Data v2 (https://docs.alpaca.markets/docs/about-market-data-api).
 * Free "Basic" plan uses the IEX feed. Used for: historical bars and batch snapshots (quotes).
 */
import type { Candle, Quote, Timeframe } from "./types";

const BASE = "https://data.alpaca.markets/v2";

const TF: Record<Timeframe, { tf: string; lookbackDays: number }> = {
  "1m": { tf: "1Min", lookbackDays: 4 },
  "5m": { tf: "5Min", lookbackDays: 10 },
  "15m": { tf: "15Min", lookbackDays: 25 },
  "1H": { tf: "1Hour", lookbackDays: 70 },
  "4H": { tf: "4Hour", lookbackDays: 240 },
  "1D": { tf: "1Day", lookbackDays: 500 },
  "1W": { tf: "1Week", lookbackDays: 2000 },
};

async function get<T>(path: string, key: string, secret: string, params: Record<string, string>): Promise<T> {
  const url = new URL(BASE + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, {
    headers: { "APCA-API-KEY-ID": key, "APCA-API-SECRET-KEY": secret, accept: "application/json" },
    cache: "no-store", signal: AbortSignal.timeout(10000),
  });
  if (res.status === 429) throw new Error("alpaca: rate limited");
  if (!res.ok) throw new Error(`alpaca ${path}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

type Bar = { t: string; o: number; h: number; l: number; c: number; v: number };

export function parseAlpacaBars(bars: Bar[] | null | undefined): Candle[] {
  return (bars ?? []).map((b) => ({ time: Math.floor(Date.parse(b.t) / 1000), open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v }));
}

export async function alpacaBars(symbol: string, tf: Timeframe, key: string, secret: string, limit = 400): Promise<Candle[]> {
  const cfg = TF[tf];
  const start = new Date(Date.now() - cfg.lookbackDays * 86400000).toISOString();
  const out: Bar[] = [];
  let token: string | undefined;
  // newest bars matter most: ask in descending order, then reverse
  do {
    const r = await get<{ bars: Bar[] | null; next_page_token: string | null }>(`/stocks/${encodeURIComponent(symbol)}/bars`, key, secret, {
      timeframe: cfg.tf, start, limit: String(Math.min(limit, 1000)), feed: "iex", adjustment: "split", sort: "desc",
      ...(token ? { page_token: token } : {}),
    });
    out.push(...(r.bars ?? []));
    token = r.next_page_token ?? undefined;
  } while (token && out.length < limit);
  return parseAlpacaBars(out.slice(0, limit).reverse());
}

type Snapshot = {
  latestTrade?: { p: number; t: string };
  dailyBar?: Bar;
  prevDailyBar?: Bar;
  minuteBar?: Bar;
};

export function parseAlpacaSnapshots(data: Record<string, Snapshot | null>): Quote[] {
  const out: Quote[] = [];
  for (const [symbol, s] of Object.entries(data ?? {})) {
    if (!s) continue;
    const price = s.latestTrade?.p ?? s.dailyBar?.c ?? s.minuteBar?.c;
    const prev = s.prevDailyBar?.c;
    if (!price || !prev) continue;
    out.push({
      symbol, price, change: price - prev, changePct: ((price - prev) / prev) * 100,
      open: s.dailyBar?.o ?? price, high: Math.max(s.dailyBar?.h ?? price, price), low: Math.min(s.dailyBar?.l ?? price, price),
      prevClose: prev, volume: s.dailyBar?.v ?? 0,
      ts: Math.floor(Date.parse(s.latestTrade?.t ?? s.dailyBar?.t ?? new Date().toISOString()) / 1000),
    });
  }
  return out;
}

export async function alpacaSnapshots(symbols: string[], key: string, secret: string): Promise<Quote[]> {
  if (symbols.length === 0) return [];
  const data = await get<Record<string, Snapshot | null> & { snapshots?: Record<string, Snapshot | null> }>("/stocks/snapshots", key, secret, { symbols: symbols.join(","), feed: "iex" });
  // the endpoint returns a map keyed by symbol (older docs wrap it in "snapshots")
  return parseAlpacaSnapshots((data.snapshots ?? data) as Record<string, Snapshot | null>);
}
