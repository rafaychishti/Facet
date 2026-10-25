import { z } from "zod";
import { ApiError, handle, ok, readJson, requireUser } from "@/lib/api";
import { isPro, startChallenge, valueAccounts } from "@/lib/engine/core";

export const GET = handle(async () => {
  const { user, db } = await requireUser();
  const [{ data: plans }, { data: chs }] = await Promise.all([
    db.from("challenge_plans").select("*").order("sort"),
    db.from("challenges").select("*, plan:challenge_plans(name, size, profit_target_pct, phase2_target_pct, min_days), account:accounts(id, cash, last_equity, status)").eq("user_id", user.id).order("started_at", { ascending: false }),
  ]);
  const active = (chs ?? []).filter((c) => c.status === "active");
  const valued = new Map((await valueAccounts(active.map((c) => c.account))).map((v) => [v.id, v.equity]));
  return ok({
    pro: await isPro(user.id),
    plans: plans ?? [],
    challenges: (chs ?? []).map((c) => ({ ...c, equity: valued.get(c.account_id) ?? c.account.last_equity ?? c.account.cash })),
  });
});

export const POST = handle(async (req: Request) => {
  const { user } = await requireUser();
  const b = z.object({ planId: z.string().min(1) }).safeParse(await readJson(req));
  if (!b.success) throw new ApiError(400, "Pick a plan.");
  return ok({ challenge: await startChallenge(user.id, b.data.planId) });
});
