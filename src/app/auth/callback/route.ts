import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/** OAuth (Google) and email-link landing: exchanges the code for a session cookie. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const code = u.searchParams.get("code");
  const next = u.searchParams.get("next") ?? "/overview";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/overview";
  if (code) {
    const db = await supabaseServer();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeNext, u.origin));
  }
  return NextResponse.redirect(new URL("/login?error=link", u.origin));
}
