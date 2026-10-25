import { z } from "zod";
import { ApiError, handle, ok, readJson, requireUser } from "@/lib/api";
import { isPro } from "@/lib/engine/core";
import { normalizeSymbol, SYMBOL_RE } from "@/lib/market/universe";

const FREE_LIMIT = 20;

async function getList(db: Awaited<ReturnType<typeof requireUser>>["db"], userId: string) {
  const { data } = await db.from("watchlists").select("id, name, items:watchlist_items(symbol, position)").eq("user_id", userId).order("created_at").limit(1).maybeSingle();
  if (data) return data;
  const { data: created } = await db.from("watchlists").insert({ user_id: userId, name: "Watchlist" }).select("id, name").single();
  return { ...created!, items: [] as { symbol: string; position: number }[] };
}

export const GET = handle(async () => {
  const { user, db } = await requireUser();
  const wl = await getList(db, user.id);
  return ok({ id: wl.id, name: wl.name, symbols: [...wl.items].sort((a, b) => a.position - b.position).map((i) => i.symbol) });
});

const body = z.object({ symbol: z.string().transform(normalizeSymbol).refine((s) => SYMBOL_RE.test(s), "Invalid symbol") });

export const POST = handle(async (req: Request) => {
  const { user, db } = await requireUser();
  const b = body.safeParse(await readJson(req));
  if (!b.success) throw new ApiError(400, b.error.issues[0].message);
  const wl = await getList(db, user.id);
  if (wl.items.length >= FREE_LIMIT && !(await isPro(user.id))) throw new ApiError(402, `Free plan watchlists hold ${FREE_LIMIT} symbols. Upgrade to Pro for unlimited.`);
  await db.from("watchlist_items").upsert({ watchlist_id: wl.id, symbol: b.data.symbol, position: wl.items.length + 1 }, { onConflict: "watchlist_id,symbol", ignoreDuplicates: true });
  return ok({ ok: true });
});

export const DELETE = handle(async (req: Request) => {
  const { user, db } = await requireUser();
  const symbol = normalizeSymbol(new URL(req.url).searchParams.get("symbol") ?? "");
  const wl = await getList(db, user.id);
  await db.from("watchlist_items").delete().eq("watchlist_id", wl.id).eq("symbol", symbol);
  return ok({ ok: true });
});
