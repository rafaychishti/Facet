import { handle, limitByIp, ok } from "@/lib/api";
import { dataSource, getQuotes } from "@/lib/market";
import { marketStatus } from "@/lib/market/hours";

export const GET = handle(async (req: Request) => {
  limitByIp(req, "market");
  const symbols = (new URL(req.url).searchParams.get("symbols") ?? "").split(",").filter(Boolean);
  const quotes = await getQuotes(symbols);
  return ok({ quotes, source: dataSource().quotes, market: marketStatus() }, { headers: { "cache-control": "private, max-age=10" } });
});
