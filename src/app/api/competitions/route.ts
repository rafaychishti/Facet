import { z } from "zod";
import { ApiError, handle, ok, readJson, requireUser } from "@/lib/api";
import { joinCompetition } from "@/lib/engine/core";

export const GET = handle(async (req: Request) => {
  const { user, db } = await requireUser();
  const { data: comps } = await db.from("competitions").select("*").order("starts_at", { ascending: false });
  const list = (comps ?? []).map((c) => ({ ...c, status: Date.now() < Date.parse(c.starts_at) ? "Upcoming" : Date.now() > Date.parse(c.ends_at) ? "Ended" : "Live" }));
  const selected = new URL(req.url).searchParams.get("id") ?? list.find((c) => c.status === "Live")?.id ?? list[0]?.id;
  const [{ data: board }, { data: mine }, { count }] = await Promise.all([
    db.rpc("get_leaderboard", { p_competition_id: selected ?? "", p_limit: 100 }),
    db.from("competition_entries").select("competition_id, account_id").eq("user_id", user.id),
    db.from("competition_entries").select("user_id", { count: "exact", head: true }).eq("competition_id", selected ?? ""),
  ]);
  return ok({
    competitions: list.map((c) => ({ ...c, joined: (mine ?? []).some((m) => m.competition_id === c.id) })),
    selected, entrants: count ?? 0,
    leaderboard: ((board ?? []) as { rank: number; name: string; handle: string | null; country: string; equity: number; return_pct: number; trades: number; is_me: boolean }[])
      .map((r) => ({ rank: Number(r.rank), name: r.name, handle: r.handle, country: r.country, equity: Number(r.equity), returnPct: Number(r.return_pct), trades: Number(r.trades), you: r.is_me })),
  });
});

export const POST = handle(async (req: Request) => {
  const { user } = await requireUser();
  const b = z.object({ competitionId: z.string().min(1) }).safeParse(await readJson(req));
  if (!b.success) throw new ApiError(400, "Pick a competition.");
  return ok(await joinCompetition(user.id, b.data.competitionId));
});
