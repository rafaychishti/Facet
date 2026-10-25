import { handle, limitByIp, ok, fail } from "@/lib/api";
import { dataSource, getCandles, TIMEFRAMES, type Timeframe } from "@/lib/market";
import { normalizeSymbol, SYMBOL_RE } from "@/lib/market/universe";

export const GET = handle(async (req: Request) => {
  limitByIp(req, "market");
  const u = new URL(req.url);
  const symbol = normalizeSymbol(u.searchParams.get("symbol") ?? "");
  const tf = (u.searchParams.get("tf") ?? "1D") as Timeframe;
  if (!SYMBOL_RE.test(symbol)) return fail(400, "Invalid symbol");
  if (!TIMEFRAMES.includes(tf)) return fail(400, "Invalid timeframe");
  const candles = await getCandles(symbol, tf);
  return ok({ symbol, tf, candles, source: dataSource().candles }, { headers: { "cache-control": "private, max-age=30" } });
});
