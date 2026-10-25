import { handle, ok, requireUser } from "@/lib/api";
import { requestPayout } from "@/lib/engine/core";

export const POST = handle(async (_req: Request, ctx: RouteContext<"/api/challenges/[id]/payout">) => {
  const { id } = await ctx.params;
  const { user } = await requireUser();
  return ok(await requestPayout(user.id, id));
});
