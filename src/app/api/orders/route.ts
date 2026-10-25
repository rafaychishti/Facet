import { handle, ok, rateLimit, readJson, requireUser } from "@/lib/api";
import { placeOrder } from "@/lib/engine/core";

export const POST = handle(async (req: Request) => {
  const { user } = await requireUser();
  rateLimit(`order:${user.id}`, 20, 10_000);
  return ok(await placeOrder(user.id, await readJson(req)));
});
