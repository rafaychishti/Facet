import { handle, ok, requireUser } from "@/lib/api";
import { payoutStatus } from "@/lib/engine/core";

export const GET = handle(async () => {
  const { user, db } = await requireUser();
  const [{ data: payouts }, { data: funded }] = await Promise.all([
    db.from("sim_payouts").select("*, challenge:challenges(public_id)").eq("user_id", user.id).order("created_at", { ascending: false }),
    db.from("challenges").select("*, account:accounts(cash)").eq("user_id", user.id).eq("status", "active").eq("phase", 3),
  ]);
  const eligible = await Promise.all((funded ?? []).map(async (c) => {
    const { count } = await db.from("positions").select("symbol", { count: "exact", head: true }).eq("account_id", c.account_id);
    return { challengeId: c.id, publicId: c.public_id, ...(await payoutStatus(c, c.account.cash, (count ?? 0) > 0)) };
  }));
  return ok({ payouts: payouts ?? [], funded: eligible });
});
