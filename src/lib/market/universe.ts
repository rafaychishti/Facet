/**
 * The screener universe: liquid US stocks and ETFs. Market cap and P/E here are
 * approximate reference values used for sorting/filtering the screener; the
 * symbol page shows live figures from the data provider.
 */
export type UniverseItem = {
  symbol: string;
  name: string;
  sector: string;
  exchange: string;
  marketCap: number;
  pe: number;
  base: number; // only used by the demo provider
  vol: number; // only used by the demo provider
};

export const UNIVERSE: UniverseItem[] = [
  { symbol: "AAPL", name: "Apple Inc.", sector: "Technology", exchange: "NASDAQ", marketCap: 3.45e12, pe: 34.1, base: 228, vol: 0.015 },
  { symbol: "MSFT", name: "Microsoft Corp.", sector: "Technology", exchange: "NASDAQ", marketCap: 3.17e12, pe: 36.4, base: 426, vol: 0.013 },
  { symbol: "NVDA", name: "NVIDIA Corp.", sector: "Semiconductors", exchange: "NASDAQ", marketCap: 3.38e12, pe: 54.2, base: 138, vol: 0.028 },
  { symbol: "GOOGL", name: "Alphabet Inc.", sector: "Communication", exchange: "NASDAQ", marketCap: 2.12e12, pe: 23.8, base: 172, vol: 0.017 },
  { symbol: "AMZN", name: "Amazon.com Inc.", sector: "Consumer", exchange: "NASDAQ", marketCap: 2.05e12, pe: 41.7, base: 196, vol: 0.019 },
  { symbol: "META", name: "Meta Platforms", sector: "Communication", exchange: "NASDAQ", marketCap: 1.48e12, pe: 27.9, base: 584, vol: 0.022 },
  { symbol: "TSLA", name: "Tesla Inc.", sector: "Automotive", exchange: "NASDAQ", marketCap: 7.9e11, pe: 68.3, base: 248, vol: 0.035 },
  { symbol: "AVGO", name: "Broadcom Inc.", sector: "Semiconductors", exchange: "NASDAQ", marketCap: 8.0e11, pe: 38.2, base: 172, vol: 0.024 },
  { symbol: "BRK.B", name: "Berkshire Hathaway B", sector: "Financials", exchange: "NYSE", marketCap: 9.8e11, pe: 13.9, base: 457, vol: 0.009 },
  { symbol: "JPM", name: "JPMorgan Chase", sector: "Financials", exchange: "NYSE", marketCap: 6.3e11, pe: 12.4, base: 221, vol: 0.012 },
  { symbol: "V", name: "Visa Inc.", sector: "Financials", exchange: "NYSE", marketCap: 5.7e11, pe: 30.1, base: 289, vol: 0.011 },
  { symbol: "MA", name: "Mastercard Inc.", sector: "Financials", exchange: "NYSE", marketCap: 4.8e11, pe: 37.5, base: 517, vol: 0.012 },
  { symbol: "LLY", name: "Eli Lilly & Co.", sector: "Healthcare", exchange: "NYSE", marketCap: 8.1e11, pe: 112.0, base: 897, vol: 0.02 },
  { symbol: "UNH", name: "UnitedHealth Group", sector: "Healthcare", exchange: "NYSE", marketCap: 5.4e11, pe: 37.0, base: 590, vol: 0.014 },
  { symbol: "JNJ", name: "Johnson & Johnson", sector: "Healthcare", exchange: "NYSE", marketCap: 3.9e11, pe: 24.0, base: 161, vol: 0.009 },
  { symbol: "XOM", name: "Exxon Mobil", sector: "Energy", exchange: "NYSE", marketCap: 5.2e11, pe: 14.3, base: 118, vol: 0.013 },
  { symbol: "WMT", name: "Walmart Inc.", sector: "Consumer", exchange: "NYSE", marketCap: 6.6e11, pe: 40.4, base: 82, vol: 0.01 },
  { symbol: "COST", name: "Costco Wholesale", sector: "Consumer", exchange: "NASDAQ", marketCap: 4.0e11, pe: 55.1, base: 905, vol: 0.011 },
  { symbol: "HD", name: "Home Depot", sector: "Consumer", exchange: "NYSE", marketCap: 4.0e11, pe: 27.6, base: 409, vol: 0.012 },
  { symbol: "NFLX", name: "Netflix Inc.", sector: "Communication", exchange: "NASDAQ", marketCap: 3.05e11, pe: 40.2, base: 712, vol: 0.021 },
  { symbol: "DIS", name: "Walt Disney Co.", sector: "Communication", exchange: "NYSE", marketCap: 1.75e11, pe: 35.0, base: 96, vol: 0.016 },
  { symbol: "AMD", name: "Advanced Micro Devices", sector: "Semiconductors", exchange: "NASDAQ", marketCap: 2.52e11, pe: 112.4, base: 156, vol: 0.029 },
  { symbol: "INTC", name: "Intel Corp.", sector: "Semiconductors", exchange: "NASDAQ", marketCap: 1.0e11, pe: 0, base: 23, vol: 0.027 },
  { symbol: "CRM", name: "Salesforce Inc.", sector: "Technology", exchange: "NYSE", marketCap: 2.8e11, pe: 49.0, base: 292, vol: 0.017 },
  { symbol: "ORCL", name: "Oracle Corp.", sector: "Technology", exchange: "NYSE", marketCap: 4.8e11, pe: 46.0, base: 173, vol: 0.018 },
  { symbol: "ADBE", name: "Adobe Inc.", sector: "Technology", exchange: "NASDAQ", marketCap: 2.2e11, pe: 43.0, base: 500, vol: 0.018 },
  { symbol: "PLTR", name: "Palantir Technologies", sector: "Technology", exchange: "NASDAQ", marketCap: 9.5e10, pe: 200.0, base: 42, vol: 0.038 },
  { symbol: "UBER", name: "Uber Technologies", sector: "Technology", exchange: "NYSE", marketCap: 1.6e11, pe: 85.0, base: 78, vol: 0.022 },
  { symbol: "SPY", name: "SPDR S&P 500 ETF", sector: "ETF", exchange: "NYSE Arca", marketCap: 5.6e11, pe: 25.2, base: 579, vol: 0.009 },
  { symbol: "QQQ", name: "Invesco QQQ Trust", sector: "ETF", exchange: "NASDAQ", marketCap: 3.1e11, pe: 33.6, base: 494, vol: 0.012 },
  { symbol: "IWM", name: "iShares Russell 2000 ETF", sector: "ETF", exchange: "NYSE Arca", marketCap: 7.0e10, pe: 18.0, base: 222, vol: 0.013 },
  { symbol: "DIA", name: "SPDR Dow Jones ETF", sector: "ETF", exchange: "NYSE Arca", marketCap: 3.5e10, pe: 22.0, base: 428, vol: 0.009 },
];

export const universeItem = (s: string) => UNIVERSE.find((u) => u.symbol === s.toUpperCase());

/** Index proxies shown on the overview strip (ETFs, because index levels need a paid feed). */
export const INDEX_PROXIES = [
  { symbol: "SPY", label: "S&P 500" },
  { symbol: "QQQ", label: "Nasdaq 100" },
  { symbol: "DIA", label: "Dow 30" },
  { symbol: "IWM", label: "Russell 2000" },
];

export const SYMBOL_RE = /^[A-Z][A-Z.\-]{0,9}$/;
export const normalizeSymbol = (s: string) => s.trim().toUpperCase();
