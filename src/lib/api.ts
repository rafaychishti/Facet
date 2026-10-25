import "server-only";
import { NextResponse } from "next/server";
import { connection } from "next/server";
import { unstable_rethrow } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";
import { EngineError } from "@/lib/engine/core";
import { supabaseConfigured } from "@/lib/env";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const ok = <T>(data: T, init?: ResponseInit) => NextResponse.json(data, init);
export const fail = (status: number, message: string) => NextResponse.json({ error: message }, { status });

/** Wrap a handler so thrown ApiErrors become clean JSON responses. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    await connection(); // API responses are always per-request, never prerendered
    try {
      return await fn(...args);
    } catch (e) {
      unstable_rethrow(e); // let Next.js internals (prerender bail-outs, redirects) through
      if (e instanceof ApiError || e instanceof EngineError) return fail(e.status, e.message);
      console.error("[api]", e);
      return fail(500, "Something went wrong. Please try again.");
    }
  };
}

/** Verifies the session with Supabase Auth (not just the cookie) and returns the user. */
export async function requireUser(): Promise<{ user: User; db: Awaited<ReturnType<typeof supabaseServer>> }> {
  if (!supabaseConfigured()) throw new ApiError(503, "Supabase isn't configured. See /setup.");
  const db = await supabaseServer();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) throw new ApiError(401, "Please log in.");
  return { user: data.user, db };
}

/* ── Tiny in-memory rate limiter (fine for a single VPS process) ── */
const g = globalThis as unknown as { __facetRate?: Map<string, number[]> };
const hits: Map<string, number[]> = (g.__facetRate ??= new Map());

export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= max) throw new ApiError(429, "Too many requests. Slow down a little.");
  list.push(now);
  hits.set(key, list);
}

export async function readJson<T = unknown>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new ApiError(400, "Invalid JSON body.");
  }
}

/** Per-IP limit for the public market-data endpoints. */
export function limitByIp(req: Request, bucket: string, max = 240, windowMs = 60_000) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
  rateLimit(`${bucket}:${ip}`, max, windowMs);
}
