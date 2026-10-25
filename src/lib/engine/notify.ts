import { serverEnv } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";

type Tone = "info" | "ok" | "warn" | "error";

/** In-app notification, plus an email when Resend is configured and the user opted in. */
type Kind = "fill" | "rule" | "alert";
const PREF: Record<Kind, string> = { fill: "notify_fills", rule: "notify_rule_warnings", alert: "notify_alerts_email" };

export async function notify(userId: string, tone: Tone, text: string, link?: string, opts: { email?: boolean; subject?: string; kind?: Kind } = {}) {
  const db = supabaseAdmin();
  let emailAllowed = opts.email ?? false;
  if (opts.kind) {
    const { data: prof } = await db.from("profiles").select(PREF[opts.kind]).eq("id", userId).maybeSingle();
    const on = (prof as Record<string, boolean> | null)?.[PREF[opts.kind]] ?? true;
    // fills and rule warnings are in-app preferences; alerts' preference controls email only
    if (opts.kind !== "alert" && !on) return;
    if (opts.kind === "alert") emailAllowed = emailAllowed && on;
  }
  await db.from("notifications").insert({ user_id: userId, tone, text, link: link ?? null });
  if (!emailAllowed) return;
  const { resendKey, emailFrom } = serverEnv();
  if (!resendKey) return;
  try {
    const { data } = await db.auth.admin.getUserById(userId);
    const to = data.user?.email;
    if (!to) return;
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: emailFrom, to, subject: opts.subject ?? "Facet notification",
        text: `${text}\n\n${link ? `Open Facet: ${process.env.NEXT_PUBLIC_SITE_URL ?? ""}${link}\n\n` : ""}You can turn these emails off in Profile → Notifications.`,
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) {
    console.error("[notify] email failed", e);
  }
}
