import { handle, ok, requireUser } from "@/lib/api";
import { cancelOrder } from "@/lib/engine/core";

export const DELETE = handle(async (_req: Request, ctx: RouteContext<"/api/orders/[id]">) => {
  const { id } = await ctx.params;
  const { user } = await requireUser();
  return ok(await cancelOrder(user.id, id));
});
