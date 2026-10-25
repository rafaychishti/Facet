import { fail, handle, ok } from "@/lib/api";
import { serverEnv } from "@/lib/env";
import { runEndOfDay, runTick } from "@/lib/engine/core";

/**
 * Runs one engine cycle. Alternative to the long-running worker, e.g. for a
 * system cron:  curl -X POST -H "authorization: Bearer $CRON_SECRET" https://facet.example/api/cron/tick
 * Add ?eod=force to run the end-of-day snapshot immediately (testing only).
 */
export const POST = handle(async (req: Request) => {
  const secret = serverEnv().cronSecret;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return fail(401, "Unauthorized");
  const force = new URL(req.url).searchParams.get("eod") === "force";
  const tick = await runTick();
  return ok(force ? { ...tick, eod: await runEndOfDay(true) } : tick);
});
