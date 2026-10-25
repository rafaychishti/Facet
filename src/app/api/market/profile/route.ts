import { handle, limitByIp, ok, fail } from "@/lib/api";
import { getProfile } from "@/lib/market";
import { normalizeSymbol, SYMBOL_RE } from "@/lib/market/universe";

export const GET = handle(async (req: Request) => {
  limitByIp(req, "market");
  const symbol = normalizeSymbol(new URL(req.url).searchParams.get("symbol") ?? "");
  if (!SYMBOL_RE.test(symbol)) return fail(400, "Invalid symbol");
  const profile = await getProfile(symbol);
  if (!profile) return fail(404, "Unknown symbol");
  return ok({ profile });
});
