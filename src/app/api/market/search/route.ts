import { handle, limitByIp, ok } from "@/lib/api";
import { searchSymbols } from "@/lib/market";

export const GET = handle(async (req: Request) => {
  limitByIp(req, "market");
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return ok({ results: await searchSymbols(q) });
});
