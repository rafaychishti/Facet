/**
 * Finnhub (https://finnhub.io/docs/api). Free plan: 60 calls/minute.
 * Used for: quotes (fallback), symbol search, company news, market news, profiles.
 */
import type { NewsItem, Profile, Quote, SearchResult } from "./types";

const BASE = "https://finnhub.io/api/v1";

async function get<T>(path: string, key: string, params: Record<string, string>): Promise<T> {
  const url = new URL(BASE + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, { headers: { "X-Finnhub-Token": key }, cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (res.status === 429) throw new Error("finnhub: rate limited");
  if (!res.ok) throw new Error(`finnhub ${path}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

type FhQuote = { c: number; d: number | null; dp: number | null; h: number; l: number; o: number; pc: number; t: number };

export function parseFinnhubQuote(symbol: string, q: FhQuote): Quote | null {
  if (!q || !q.c) return null; // Finnhub returns zeros for unknown symbols
  return {
    symbol, price: q.c, change: q.d ?? q.c - q.pc, changePct: q.dp ?? ((q.c - q.pc) / q.pc) * 100,
    open: q.o, high: q.h, low: q.l, prevClose: q.pc, volume: 0, ts: q.t,
  };
}

export async function finnhubQuote(symbol: string, key: string) {
  return parseFinnhubQuote(symbol, await get<FhQuote>("/quote", key, { symbol }));
}

type FhSearch = { count: number; result: { description: string; displaySymbol: string; symbol: string; type: string }[] };

export function parseFinnhubSearch(r: FhSearch): SearchResult[] {
  return (r.result ?? [])
    // US listings only: no exchange suffix (".L", ".TO" ...) except class shares like BRK.B
    .filter((x) => /^[A-Z]{1,5}(\.[A-B])?$/.test(x.symbol) && (x.type === "Common Stock" || x.type === "ETP" || x.type === "ADR"))
    .slice(0, 10)
    .map((x) => ({ symbol: x.symbol, name: titleCase(x.description), type: x.type }));
}

export async function finnhubSearch(q: string, key: string) {
  return parseFinnhubSearch(await get<FhSearch>("/search", key, { q, exchange: "US" }));
}

type FhNews = { id: number; datetime: number; headline: string; summary: string; source: string; url: string; image: string; related: string }[];

export function parseFinnhubNews(items: FhNews, symbol?: string): NewsItem[] {
  return (items ?? [])
    .filter((n) => n.headline && n.url)
    .sort((a, b) => b.datetime - a.datetime)
    .slice(0, 20)
    .map((n) => ({
      id: String(n.id), source: n.source, datetime: n.datetime, headline: n.headline,
      summary: n.summary?.slice(0, 280) ?? "", url: n.url, image: n.image || undefined,
      symbols: n.related ? n.related.split(",").filter(Boolean).slice(0, 3) : symbol ? [symbol] : [],
    }));
}

export async function finnhubNews(key: string, symbol?: string) {
  if (!symbol) return parseFinnhubNews(await get<FhNews>("/news", key, { category: "general" }));
  const to = new Date();
  const from = new Date(to.getTime() - 7 * 86400000);
  const d = (x: Date) => x.toISOString().slice(0, 10);
  return parseFinnhubNews(await get<FhNews>("/company-news", key, { symbol, from: d(from), to: d(to) }), symbol);
}

type FhProfile = { name?: string; ticker?: string; exchange?: string; finnhubIndustry?: string; country?: string; currency?: string; marketCapitalization?: number; logo?: string; weburl?: string; ipo?: string };
type FhMetric = { metric?: Record<string, number | null> };

export function parseFinnhubProfile(symbol: string, p: FhProfile, m: FhMetric): Profile | null {
  if (!p || !p.name) return null;
  const metric = m?.metric ?? {};
  return {
    symbol, name: p.name, exchange: p.exchange ?? "US", sector: p.finnhubIndustry ?? "—", country: p.country,
    currency: p.currency ?? "USD",
    marketCap: p.marketCapitalization ? p.marketCapitalization * 1e6 : undefined, // Finnhub reports millions
    pe: (metric.peTTM ?? metric.peBasicExclExtraTTM ?? undefined) || undefined,
    week52High: metric["52WeekHigh"] ?? undefined, week52Low: metric["52WeekLow"] ?? undefined,
    logo: p.logo || undefined, weburl: p.weburl || undefined, ipo: p.ipo,
  };
}

export async function finnhubProfile(symbol: string, key: string) {
  const [p, m] = await Promise.all([
    get<FhProfile>("/stock/profile2", key, { symbol }),
    get<FhMetric>("/stock/metric", key, { symbol, metric: "all" }).catch(() => ({})),
  ]);
  return parseFinnhubProfile(symbol, p, m);
}

const titleCase = (s: string) => s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/\b(Inc|Corp|Co|Ltd|Plc|Etf)\b/g, (w) => w);
