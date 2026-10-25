import { handle, limitByIp, ok } from "@/lib/api";
import { dataSource, getNews } from "@/lib/market";

export const GET = handle(async (req: Request) => {
  limitByIp(req, "market");
  const symbol = new URL(req.url).searchParams.get("symbol") ?? undefined;
  return ok({ news: await getNews(symbol || undefined), source: dataSource().news }, { headers: { "cache-control": "private, max-age=120" } });
});
