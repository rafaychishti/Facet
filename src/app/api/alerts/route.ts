import { z } from "zod";
import { ApiError, handle, ok, readJson, requireUser } from "@/lib/api";
import { isPro } from "@/lib/engine/core";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { normalizeSymbol, SYMBOL_RE } from "@/lib/market/universe";

const FREE_LIMIT = 3;

export const GET = handle(async () => {
  const { user, db } = await requireUser();
  const { data } = await db.from("alerts").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
  return ok({ alerts: data ?? [], limit: (await isPro(user.id)) ? null : FREE_LIMIT });
});

const body = z.object({
  symbol: z.string().transform(normalizeSymbol).refine((s) => SYMBOL_RE.test(s), "Invalid symbol"),
  condition: z.enum(["price_above", "price_below", "pct_change_above", "pct_change_below"]),
  value: z.coerce.number().finite().positive("Value must be positive"),
  notifyEmail: z.boolean().default(true),
});

export const POST = handle(async (req: Request) => {
  const { user, db } = await requireUser();
  const b = body.safeParse(await readJson(req));
  if (!b.success) throw new ApiError(400, b.error.issues[0].message);
  if (!(await isPro(user.id))) {
    const { count } = await db.from("alerts").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "active");
    if ((count ?? 0) >= FREE_LIMIT) throw new ApiError(402, `The free plan includes ${FREE_LIMIT} active alerts. Upgrade to Pro for unlimited alerts.`);
  }
  const { data, error } = await supabaseAdmin().from("alerts")
    .insert({ user_id: user.id, symbol: b.data.symbol, condition: b.data.condition, value: b.data.value, notify_email: b.data.notifyEmail })
    .select("*").single();
  if (error) throw new ApiError(500, "Could not create the alert.");
  return ok({ alert: data });
});
