import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PROTECTED = ["/overview", "/terminal", "/markets", "/symbol", "/portfolio", "/alerts", "/challenges", "/leaderboard", "/certificates", "/payouts", "/billing", "/affiliate", "/profile", "/help"];
const AUTH_PAGES = ["/login", "/signup"];

/**
 * Refreshes the Supabase session cookie on every request and does an
 * optimistic redirect for signed-out visitors. Real authorisation happens
 * in every API route (requireUser) and in the database (RLS).
 */
export async function proxy(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const path = req.nextUrl.pathname;
  const isProtected = PROTECTED.some((p) => path === p || path.startsWith(p + "/"));

  if (!url || !key) {
    return isProtected ? NextResponse.redirect(new URL("/setup", req.url)) : NextResponse.next();
  }

  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user && isProtected) {
    const to = new URL("/login", req.url);
    to.searchParams.set("next", path + req.nextUrl.search);
    return NextResponse.redirect(to);
  }
  // signed-in users skip the login/signup pages (full page loads only, not router prefetches)
  const isRsc = req.headers.has("rsc") || req.headers.has("next-router-prefetch");
  if (user && AUTH_PAGES.includes(path) && !isRsc) return NextResponse.redirect(new URL("/overview", req.url));
  return res;
}

export const config = {
  // skip static assets, images, webhooks and cron (they don't use cookies)
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/stripe/webhook|api/cron|.*\\.(?:png|jpg|svg|ico|webp|woff2?)$).*)"],
};
