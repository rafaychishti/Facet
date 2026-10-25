/**
 * Demo market data, used automatically when no API keys are configured.
 * Prices drift slowly over time (deterministically), so orders, alerts and
 * challenges behave realistically in development.
 */
import type { Candle, MarketProvider, NewsItem, Profile, Quote, SearchResult, Timeframe } from "./types";
import { TF_SECONDS } from "./types";
import { UNIVERSE, universeItem } from "./universe";

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);

const meta = (symbol: string) =>
  universeItem(symbol) ?? { symbol, name: symbol, sector: "Other", exchange: "US", marketCap: 1e10, pe: 20, base: 20 + (Math.abs(hash(symbol)) % 300), vol: 0.02 };

/** Live demo price: base price with slow, deterministic drift. */
export function demoPrice(symbol: string, at = Date.now() / 1000) {
  const m = meta(symbol);
  const h = Math.abs(hash(symbol)) % 1000;
  const drift = 0.012 * Math.sin(at / 7200 + h) + 0.004 * Math.sin(at / 600 + h * 2) + 0.0015 * Math.sin(at / 45 + h);
  return Math.round(m.base * (1 + drift) * 100) / 100;
}

export function demoCandles(symbol: string, tf: Timeframe, count = 320): Candle[] {
  const m = meta(symbol);
  const r = rng(hash(symbol + tf));
  const step = TF_SECONDS[tf];
  const scale = Math.sqrt(step / 86400);
  const vol = m.vol * scale;
  const now = Math.floor(Date.now() / 1000);
  const end = now - (now % step);
  const closes: number[] = [demoPrice(symbol, now)];
  for (let i = 1; i < count; i++) {
    const shock = (r() - 0.5) * 2 * vol + (r() - 0.5) * vol;
    closes.unshift(closes[0] / (1 + 0.0003 * scale + shock));
  }
  const start = end - step * (count - 1);
  return closes.map((close, i) => {
    const open = i === 0 ? close * (1 + (r() - 0.5) * vol) : closes[i - 1];
    const wick = Math.abs(close - open) + close * vol * r() * 0.8;
    const high = Math.max(open, close) + wick * r();
    const low = Math.min(open, close) - wick * r();
    const volume = Math.round((m.marketCap / m.base) * 0.004 * (0.5 + r()) * scale);
    return { time: start + i * step, open, high, low, close, volume };
  });
}

const NEWS_TEMPLATES = [
  { source: "Reuters", h: "{name} shares move as traders weigh sector outlook", s: "Analysts pointed to shifting demand expectations and positioning ahead of earnings." },
  { source: "Bloomberg", h: "What options traders are pricing in for {symbol}", s: "Implied volatility suggests a sizeable move around the next catalyst." },
  { source: "CNBC", h: "{name} management outlines priorities for the year ahead", s: "Executives highlighted margins, capital returns and product roadmap." },
  { source: "MarketWatch", h: "Stocks to watch: {symbol} among today's most active names", s: "Volume ran above its 30-day average as investors repositioned." },
  { source: "Barron's", h: "Is {name} still a buy after its recent run?", s: "Valuation, growth and competition are the three questions investors keep asking." },
  { source: "WSJ", h: "Treasury yields and the dollar set the tone for equities", s: "The 10-year yield edged higher as traders trimmed rate-cut bets." },
];

export const mockProvider: MarketProvider = {
  async quotes(symbols) {
    return symbols.map((symbol): Quote => {
      const daily = demoCandles(symbol, "1D", 3);
      const price = demoPrice(symbol);
      const prev = daily[daily.length - 2].close;
      const today = daily[daily.length - 1];
      return {
        symbol, price, change: price - prev, changePct: ((price - prev) / prev) * 100,
        open: today.open, high: Math.max(today.high, price), low: Math.min(today.low, price),
        prevClose: prev, volume: today.volume, ts: Math.floor(Date.now() / 1000),
      };
    });
  },
  async candles(symbol, tf) {
    return demoCandles(symbol, tf, tf === "1W" ? 200 : 320);
  },
  async search(q) {
    const s = q.toLowerCase();
    return UNIVERSE.filter((u) => (u.symbol + " " + u.name).toLowerCase().includes(s))
      .slice(0, 10)
      .map((u): SearchResult => ({ symbol: u.symbol, name: u.name, exchange: u.exchange, type: u.sector === "ETF" ? "ETP" : "Common Stock" }));
  },
  async news(symbol) {
    const now = Math.floor(Date.now() / 1000);
    const pool = symbol ? [meta(symbol)] : UNIVERSE.slice(0, 8);
    return NEWS_TEMPLATES.map((t, i): NewsItem => {
      const m = pool[i % pool.length];
      return {
        id: `demo-${m.symbol}-${i}`, source: t.source, datetime: now - (i + 1) * 2400,
        headline: t.h.replace("{name}", m.name).replace("{symbol}", m.symbol), summary: t.s, url: "#", symbols: [m.symbol],
      };
    });
  },
  async profile(symbol): Promise<Profile | null> {
    const m = meta(symbol);
    const year = demoCandles(symbol, "1D", 252);
    return {
      symbol: m.symbol, name: m.name, exchange: m.exchange, sector: m.sector, currency: "USD", country: "US",
      marketCap: m.marketCap, pe: m.pe || undefined,
      week52High: Math.max(...year.map((c) => c.high)), week52Low: Math.min(...year.map((c) => c.low)),
    };
  },
};
