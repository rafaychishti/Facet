import { z } from "zod";
import { ApiError, handle, ok, readJson, requireUser } from "@/lib/api";

export const GET = handle(async () => {
  const { user, db } = await requireUser();
  const { data } = await db.from("affiliate_applications").select("*").eq("user_id", user.id).maybeSingle();
  return ok({ application: data });
});

const body = z.object({ website: z.string().trim().max(200).default(""), audience: z.string().trim().min(10, "Tell us a little about your audience (10+ characters).").max(1000) });

export const POST = handle(async (req: Request) => {
  const { user, db } = await requireUser();
  const b = body.safeParse(await readJson(req));
  if (!b.success) throw new ApiError(400, b.error.issues[0].message);
  const { error } = await db.from("affiliate_applications").insert({ user_id: user.id, ...b.data });
  if (error?.code === "23505") throw new ApiError(409, "You've already applied.");
  if (error) throw new ApiError(400, error.message);
  return ok({ ok: true });
});
