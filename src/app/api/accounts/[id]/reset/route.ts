import { handle, ok, requireUser } from "@/lib/api";
import { resetAccount } from "@/lib/engine/core";

export const POST = handle(async (_req: Request, ctx: RouteContext<"/api/accounts/[id]/reset">) => {
  const { id } = await ctx.params;
  const { user } = await requireUser();
  return ok(await resetAccount(user.id, id));
});
