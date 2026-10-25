/**
 * Facet background worker: matches working orders, checks challenge rules and
 * alerts, refreshes account equity and takes end-of-day snapshots.
 *
 *   npm run worker            (reads .env.local / .env)
 *
 * Run exactly ONE worker per deployment (e.g. a second container or a
 * systemd service on the VPS). It's safe to restart at any time.
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const INTERVAL_MS = Number(process.env.WORKER_INTERVAL_MS ?? 20_000);
let stopping = false;
let running = false;

async function main() {
  const { runTick } = await import("../src/lib/engine/core");
  const { marketStatus } = await import("../src/lib/market/hours");
  console.log(`[worker] started · tick every ${INTERVAL_MS / 1000}s · ${marketStatus().label}`);

  const tick = async () => {
    if (running || stopping) return;
    running = true;
    try {
      const r = await runTick();
      if (r.matched.filled || r.alerts.triggered || r.eod.snapshots) {
        console.log(`[worker] ${new Date().toISOString()} filled=${r.matched.filled}/${r.matched.checked} alerts=${r.alerts.triggered} eod=${r.eod.snapshots} ${r.ms}ms`);
      }
    } catch (e) {
      console.error("[worker] tick failed", e);
    } finally {
      running = false;
    }
  };

  await tick();
  const timer = setInterval(tick, INTERVAL_MS);
  const stop = () => {
    stopping = true;
    clearInterval(timer);
    console.log("[worker] stopping");
    const wait = setInterval(() => !running && (clearInterval(wait), process.exit(0)), 100);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
