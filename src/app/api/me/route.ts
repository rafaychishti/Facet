import { z } from "zod";
import { ApiError, handle, ok, readJson, requireUser } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const GET = handle(async () => {
  const { user, db } = await requireUser();
  const [{ data: profile }, { data: sub }, { data: notes }, { count: unread }] = await Promise.all([
    db.from("profiles").select("*").eq("id", user.id).single(),
    db.from("subscriptions").select("status, trial_end, current_period_end, cancel_at_period_end, interval").eq("user_id", user.id).maybeSingle(),
    db.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(15),
    db.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("read_at", null),
  ]);
  const pro = sub?.status === "trialing" || sub?.status === "active";
  return ok({
    id: user.id, email: user.email, profile, subscription: sub, plan: pro ? "pro" : "free",
    trialDaysLeft: sub?.status === "trialing" && sub.trial_end ? Math.max(0, Math.ceil((Date.parse(sub.trial_end) - Date.now()) / 86400000)) : null,
    notifications: notes ?? [], unread: unread ?? 0,
  });
});

const patch = z.object({
  full_name: z.string().trim().max(80).optional(),
  handle: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,20}$/, "Handle: 3-20 letters, numbers or _").optional().or(z.literal("").transform(() => undefined)),
  country: z.string().trim().max(60).optional(),
  public_profile: z.boolean().optional(),
  language: z.enum(["en", "ur"]).optional(),
  notify_fills: z.boolean().optional(),
  notify_alerts_email: z.boolean().optional(),
  notify_rule_warnings: z.boolean().optional(),
});

export const PATCH = handle(async (req: Request) => {
  const { user, db } = await requireUser();
  const body = patch.safeParse(await readJson(req));
  if (!body.success) throw new ApiError(400, body.error.issues[0].message);
  const { data, error } = await db.from("profiles").update(body.data).eq("id", user.id).select("*").single();
  if (error?.code === "23505") throw new ApiError(409, "That handle is taken.");
  if (error) throw new ApiError(400, error.message);
  return ok({ profile: data });
});

export const DELETE = handle(async () => {
  const { user } = await requireUser();
  await supabaseAdmin().auth.admin.deleteUser(user.id); // cascades to every table
  return ok({ ok: true });
});
