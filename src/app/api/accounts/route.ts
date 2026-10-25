import { handle, ok, requireUser } from "@/lib/api";
import { valueAccounts } from "@/lib/engine/core";

/** All of the user's accounts with live equity. */
export const GET = handle(async () => {
  const { user, db } = await requireUser();
  const { data } = await db.from("accounts").select("*").eq("user_id", user.id).order("created_at");
  const accounts = data ?? [];
  const valued = new Map((await valueAccounts(accounts.filter((a) => a.status === "active"))).map((v) => [v.id, v]));
  return ok({
    accounts: accounts.map((a) => {
      const v = valued.get(a.id);
      const equity = v?.equity ?? a.last_equity ?? a.cash;
      return { ...a, equity, invested: v?.invested ?? 0, pnl: equity - a.starting_balance, pnlPct: ((equity - a.starting_balance) / a.starting_balance) * 100, positions: v?.holdings.length ?? 0 };
    }),
  });
});
