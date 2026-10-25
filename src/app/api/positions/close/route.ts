import { z } from "zod";
import { ApiError, handle, ok, readJson, requireUser } from "@/lib/api";
import { closePosition } from "@/lib/engine/core";

const body = z.object({ accountId: z.string().uuid(), symbol: z.string().min(1).max(10) });

export const POST = handle(async (req: Request) => {
  const { user } = await requireUser();
  const b = body.safeParse(await readJson(req));
  if (!b.success) throw new ApiError(400, "Invalid request.");
  return ok(await closePosition(user.id, b.data.accountId, b.data.symbol));
});
