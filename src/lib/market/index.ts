/**
 * Market data facade. Picks the best configured source per data type and
 * caches everything, so the free API tiers are never exceeded.
 *
 *   quotes   → Alpaca snapshots (batch) → Finnhub /quote → demo
 *   candles  → Alpaca bars → demo
 *   search   → Finnhub → local universe
 *   news     → Finnhub → demo
 *   profile  → Finnhub → local universe
 */
import { serverEnv } from "@/lib/env";
import { cached, peek } from "./cache";
import { alpacaBars, alpacaSnapshots } from "./alpaca";
import { finnhubNews, finnhubProfile, finnhubQuote, finnhubSearch } from "./finnhub";
import { mockProvider } from "./mock";
import type { Candle, DataSource, NewsItem, Profile, Quote, SearchResult, Timeframe } from "./types";
import { normalizeSymbol, SYMBOL_RE } from "./universe";

const QUOTE_TTL = 15_000;
const TTL_BY_TF: Record<Timeframe, number> = { "1m": 30_000, "5m": 60_000, "15m": 120_000, "1H": 300_000, "4H": 600_000, "1D": 900_000, "1W": 3_600_000 };

const keys = () => {
  const e = serverEnv();
  return { alpaca: e.alpacaKey && e.alpacaSecret ? { key: e.alpacaKey, secret: e.alpacaSecret } : null, finnhub: e.finnhubKey || null };
};

export function dataSource(): { quotes: DataSource; candles: DataSource; news: DataSource } {
  const k = keys();
  return { quotes: k.alpaca || k.finnhub ? "live" : "demo", candles: k.alpaca ? "live" : "demo", news: k.finnhub ? "live" : "demo" };
}

export function cleanSymbols(input: string[]): string[] {
  return [...new Set(input.map(normalizeSymbol).filter((s) => SYMBOL_RE.test(s)))].slice(0, 60);
}

export async function getQuotes(symbols: string[]): Promise<Quote[]> {
  const list = cleanSymbols(symbols);
  const fresh: Quote[] = [];
  const missing: string[] = [];
  for (const s of list) {
    const q = peek<Quote>(`q:${s}`);
    if (q) fresh.push(q);
    else missing.push(s);
  }
  if (missing.length) {
    const k = keys();
    let loaded: Quote[] = [];
    try {
      if (k.alpaca) {
        loaded = await cached(`qb:${missing.join(",")}`, QUOTE_TTL, () => alpacaSnapshots(missing, k.alpaca!.key, k.alpaca!.secret));
      } else if (k.finnhub) {
        // Finnhub is one call per symbol: cap concurrency to stay under 60/min
        const batch = missing.slice(0, 25);
        loaded = (await Promise.all(batch.map((s) => cached(`fq:${s}`, QUOTE_TTL, () => finnhubQuote(s, k.finnhub!)).catch(() => null)))).filter(Boolean) as Quote[];
      } else {
        loaded = await mockProvider.quotes(missing);
      }
    } catch (e) {
      console.error("[market] quotes failed, falling back to demo", e);
      loaded = await mockProvider.quotes(missing);
    }
    // warm the per-symbol cache for next time
    await Promise.all(loaded.map((q) => cached(`q:${q.symbol}`, QUOTE_TTL, async () => q)));
    fresh.push(...loaded);
  }
  const order = new Map(list.map((s, i) => [s, i]));
  return fresh.sort((a, b) => (order.get(a.symbol) ?? 0) - (order.get(b.symbol) ?? 0));
}

export async function getQuote(symbol: string): Promise<Quote | null> {
  return (await getQuotes([symbol]))[0] ?? null;
}

export async function getCandles(symbol: string, tf: Timeframe): Promise<Candle[]> {
  const s = normalizeSymbol(symbol);
  const k = keys();
  return cached(`c:${s}:${tf}`, TTL_BY_TF[tf], async () => {
    if (k.alpaca) {
      try {
        const bars = await alpacaBars(s, tf, k.alpaca.key, k.alpaca.secret);
        if (bars.length) return bars;
      } catch (e) {
        console.error("[market] bars failed", e);
      }
    }
    return mockProvider.candles(s, tf);
  });
}

export async function searchSymbols(q: string): Promise<SearchResult[]> {
  const query = q.trim().slice(0, 40);
  if (!query) return [];
  const k = keys();
  return cached(`s:${query.toLowerCase()}`, 3_600_000, async () => {
    const local = await mockProvider.search(query);
    if (!k.finnhub) return local;
    try {
      const remote = await finnhubSearch(query, k.finnhub);
      const seen = new Set(local.map((r) => r.symbol));
      return [...local, ...remote.filter((r) => !seen.has(r.symbol))].slice(0, 10);
    } catch {
      return local;
    }
  });
}

export async function getNews(symbol?: string): Promise<NewsItem[]> {
  const s = symbol ? normalizeSymbol(symbol) : undefined;
  const k = keys();
  return cached(`n:${s ?? "_"}`, 600_000, async () => {
    if (k.finnhub) {
      try {
        const items = await finnhubNews(k.finnhub, s);
        if (items.length) return items;
      } catch (e) {
        console.error("[market] news failed", e);
      }
    }
    return mockProvider.news(s);
  });
}

export async function getProfile(symbol: string): Promise<Profile | null> {
  const s = normalizeSymbol(symbol);
  const k = keys();
  return cached(`p:${s}`, 86_400_000, async () => {
    if (k.finnhub) {
      try {
        const p = await finnhubProfile(s, k.finnhub);
        if (p) return p;
      } catch (e) {
        console.error("[market] profile failed", e);
      }
    }
    return mockProvider.profile(s);
  });
}

export * from "./types";
