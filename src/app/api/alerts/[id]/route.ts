import { z } from "zod";
import { ApiError, handle, ok, readJson, requireUser } from "@/lib/api";

const body = z.object({ status: z.enum(["active", "paused"]) });

export const PATCH = handle(async (req: Request, ctx: RouteContext<"/api/alerts/[id]">) => {
  const { id } = await ctx.params;
  const { db } = await requireUser();
  const b = body.safeParse(await readJson(req));
  if (!b.success) throw new ApiError(400, "Invalid status.");
  const { data } = await db.from("alerts").update({ status: b.data.status, triggered_at: null }).eq("id", id).select("*").maybeSingle();
  if (!data) throw new ApiError(404, "Alert not found.");
  return ok({ alert: data });
});

export const DELETE = handle(async (_req: Request, ctx: RouteContext<"/api/alerts/[id]">) => {
  const { id } = await ctx.params;
  const { db } = await requireUser();
  await db.from("alerts").delete().eq("id", id);
  return ok({ ok: true });
});
