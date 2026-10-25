import { handle, ok, requireUser } from "@/lib/api";

export const GET = handle(async () => {
  const { user, db } = await requireUser();
  const { data } = await db.from("certificates").select("*").eq("user_id", user.id).order("issued_at", { ascending: false });
  return ok({ certificates: data ?? [] });
});
