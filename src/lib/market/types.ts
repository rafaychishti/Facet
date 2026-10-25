export type Timeframe = "1m" | "5m" | "15m" | "1H" | "4H" | "1D" | "1W";
export const TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "1H", "4H", "1D", "1W"];
export const TF_SECONDS: Record<Timeframe, number> = {
  "1m": 60, "5m": 300, "15m": 900, "1H": 3600, "4H": 14400, "1D": 86400, "1W": 604800,
};

export type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number };

export type Quote = {
  symbol: string;
  price: number;
  change: number;
  changePct: number;
  open: number;
  high: number;
  low: number;
  prevClose: number;
  volume: number;
  ts: number; // unix seconds of last trade
};

export type SearchResult = { symbol: string; name: string; exchange?: string; type?: string };

export type NewsItem = {
  id: string;
  source: string;
  datetime: number; // unix seconds
  headline: string;
  summary: string;
  url: string;
  image?: string;
  symbols: string[];
};

export type Profile = {
  symbol: string;
  name: string;
  exchange: string;
  sector: string;
  country?: string;
  currency: string;
  marketCap?: number; // USD
  pe?: number;
  week52High?: number;
  week52Low?: number;
  logo?: string;
  weburl?: string;
  ipo?: string;
};

export type DataSource = "live" | "demo";

export interface MarketProvider {
  quotes(symbols: string[]): Promise<Quote[]>;
  candles(symbol: string, tf: Timeframe): Promise<Candle[]>;
  search(q: string): Promise<SearchResult[]>;
  news(symbol?: string): Promise<NewsItem[]>;
  profile(symbol: string): Promise<Profile | null>;
}
