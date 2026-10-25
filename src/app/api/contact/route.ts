import { z } from "zod";
import { ApiError, handle, ok, rateLimit, readJson } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";

const body = z.object({
  name: z.string().trim().min(1, "Please add your name.").max(120),
  email: z.string().trim().email("Please enter a valid email."),
  message: z.string().trim().min(5, "Message is too short.").max(5000),
  company: z.string().optional(), // honeypot: real users never fill this
});

export const POST = handle(async (req: Request) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  rateLimit(`contact:${ip}`, 5, 3_600_000);
  const b = body.safeParse(await readJson(req));
  if (!b.success) throw new ApiError(400, b.error.issues[0].message);
  if (b.data.company) return ok({ ok: true }); // bot: pretend success
  await supabaseAdmin().from("contact_messages").insert({ name: b.data.name, email: b.data.email, message: b.data.message });
  return ok({ ok: true });
});
