import { handle, limitByIp, ok } from "@/lib/api";
import { dataSource, getQuotes } from "@/lib/market";
import { UNIVERSE } from "@/lib/market/universe";

export const GET = handle(async (req: Request) => {
  limitByIp(req, "market");
  const quotes = new Map((await getQuotes(UNIVERSE.map((u) => u.symbol))).map((q) => [q.symbol, q]));
  const rows = UNIVERSE.map((u) => ({ symbol: u.symbol, name: u.name, sector: u.sector, exchange: u.exchange, marketCap: u.marketCap, pe: u.pe, quote: quotes.get(u.symbol) ?? null }));
  return ok({ rows, source: dataSource().quotes }, { headers: { "cache-control": "private, max-age=15" } });
});
