import { describe, expect, it } from "vitest";
import { parseAlpacaBars, parseAlpacaSnapshots } from "@/lib/market/alpaca";
import { parseFinnhubNews, parseFinnhubProfile, parseFinnhubQuote, parseFinnhubSearch } from "@/lib/market/finnhub";
import { isMarketOpen, tradingDayKey } from "@/lib/market/hours";

describe("Finnhub parsers", () => {
  it("parses a quote and ignores unknown symbols", () => {
    expect(parseFinnhubQuote("AAPL", { c: 230, d: 2, dp: 0.88, h: 231, l: 227, o: 228, pc: 228, t: 1761249600 })).toMatchObject({ price: 230, changePct: 0.88, prevClose: 228 });
    expect(parseFinnhubQuote("ZZZZ", { c: 0, d: null, dp: null, h: 0, l: 0, o: 0, pc: 0, t: 0 })).toBeNull();
  });
  it("keeps only US listings in search", () => {
    const r = parseFinnhubSearch({ count: 3, result: [
      { description: "APPLE INC", displaySymbol: "AAPL", symbol: "AAPL", type: "Common Stock" },
      { description: "APPLE INC", displaySymbol: "AAPL.MX", symbol: "AAPL.MX", type: "Common Stock" },
      { description: "BERKSHIRE HATHAWAY INC-CL B", displaySymbol: "BRK.B", symbol: "BRK.B", type: "Common Stock" },
    ] });
    expect(r.map((x) => x.symbol)).toEqual(["AAPL", "BRK.B"]);
    expect(r[0].name).toBe("Apple Inc");
  });
  it("converts market cap from millions and sorts news newest first", () => {
    expect(parseFinnhubProfile("AAPL", { name: "Apple Inc", marketCapitalization: 3_400_000 }, { metric: { peTTM: 34, "52WeekHigh": 260 } })).toMatchObject({ marketCap: 3.4e12, pe: 34, week52High: 260 });
    const n = parseFinnhubNews([
      { id: 1, datetime: 100, headline: "old", summary: "", source: "x", url: "u1", image: "", related: "AAPL" },
      { id: 2, datetime: 200, headline: "new", summary: "", source: "x", url: "u2", image: "", related: "" },
    ], "AAPL");
    expect(n.map((x) => x.headline)).toEqual(["new", "old"]);
    expect(n[0].symbols).toEqual(["AAPL"]);
  });
});

describe("Alpaca parsers", () => {
  it("parses bars", () => {
    expect(parseAlpacaBars([{ t: "2026-10-23T13:30:00Z", o: 1, h: 2, l: 0.5, c: 1.5, v: 100 }])[0]).toEqual({ time: 1792762200, open: 1, high: 2, low: 0.5, close: 1.5, volume: 100 });
  });
  it("parses snapshots and skips incomplete ones", () => {
    const q = parseAlpacaSnapshots({
      AAPL: { latestTrade: { p: 231, t: "2026-10-23T19:59:00Z" }, dailyBar: { t: "", o: 228, h: 232, l: 227, c: 231, v: 1e6 }, prevDailyBar: { t: "", o: 0, h: 0, l: 0, c: 228, v: 0 } },
      BAD: { latestTrade: { p: 5, t: "" } },
    });
    expect(q).toHaveLength(1);
    expect(q[0].changePct).toBeCloseTo(1.3158, 3);
  });
});

describe("market hours", () => {
  it("knows the regular session in New York time", () => {
    expect(isMarketOpen(new Date("2026-10-23T14:00:00Z"))).toBe(true); // Fri 10:00 ET
    expect(isMarketOpen(new Date("2026-10-23T20:30:00Z"))).toBe(false); // Fri 16:30 ET
    expect(isMarketOpen(new Date("2026-10-24T15:00:00Z"))).toBe(false); // Saturday
    expect(isMarketOpen(new Date("2026-11-26T15:00:00Z"))).toBe(false); // Thanksgiving
  });
  it("keys trading days by New York date", () => {
    expect(tradingDayKey(new Date("2026-10-24T02:00:00Z"))).toBe("2026-10-23"); // 10 PM ET Friday
  });
});
