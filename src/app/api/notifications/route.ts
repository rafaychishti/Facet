import { handle, ok, requireUser } from "@/lib/api";

/** Mark all notifications as read. */
export const POST = handle(async () => {
  const { user, db } = await requireUser();
  await db.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  return ok({ ok: true });
});
