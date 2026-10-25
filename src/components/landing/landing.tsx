"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, BarChart3, CandlestickChart, Check, Flag, Lock, ShieldCheck, Sparkles, Trophy, Zap } from "lucide-react";
import { Badge, Card, Field, LinkButton, Sparkline, inputCls } from "@/components/ui";
import { PricingPlans } from "@/components/pricing-plans";
import { useQuotes } from "@/lib/hooks";
import { UNIVERSE } from "@/lib/market/universe";
import { cn, num } from "@/lib/format";

const SceneCubes = dynamic(() => import("./scene-cubes"), { ssr: false });
const SceneGlobe = dynamic(() => import("./scene-globe"), { ssr: false });
const PriceChart = dynamic(() => import("@/components/charts/price-chart").then((m) => m.PriceChart), { ssr: false });

// Static illustration data for the example leaderboard card
const EXAMPLE_SPARK: Record<string, number[]> = Object.fromEntries(
  ["AAPL", "NVDA", "MSFT"].map((s, k) => [s, Array.from({ length: 20 }, (_, i) => 100 + i * 0.8 + Math.sin(i / 1.7 + k) * 2.4)]),
);

function ScrollRail({ progress }: { progress: number }) {
  const filled = Math.round(progress * 10);
  return (
    <div className="fixed top-1/2 left-6 z-30 hidden -translate-y-1/2 flex-col items-center gap-1 lg:flex">
      <span className="text-[10px] text-dim">[</span>
      {Array.from({ length: 10 }).map((_, i) => (
        <span key={i} className={cn("h-2 w-3 rounded-[2px] transition-colors", i < filled ? "bg-text" : "bg-white/15")} />
      ))}
      <span className="text-[10px] text-dim">]</span>
      <span className="accent mt-2 text-xs text-muted">{Math.round(progress * 100)}%</span>
    </div>
  );
}

function Socials() {
  return (
    <div className="fixed top-1/2 right-6 z-30 hidden -translate-y-1/2 flex-col gap-2 lg:flex">
      {["X", "in", "D"].map((s) => (
        <a key={s} href="#" className="grid size-7 place-items-center rounded-md border border-line bg-white/[0.04] text-[11px] font-semibold text-muted hover:text-text">{s}</a>
      ))}
    </div>
  );
}

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-line bg-white/[0.03] px-3 py-1 text-[11px] text-muted">
    <span className="size-1 rounded-full bg-blue-glow" /> {children}
  </p>
);

export function Landing() {
  const scroll = useRef(0);
  const [progress, setProgress] = useState(0);
  const { quotes } = useQuotes(UNIVERSE.slice(0, 14).map((u) => u.symbol), 30_000);
  const [sent, setSent] = useState<"idle" | "sending" | "sent" | string>("idle");
  const contact = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setSent("sending");
    const res = await fetch("/api/contact", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(f)) });
    const body = await res.json().catch(() => ({}));
    setSent(res.ok ? "sent" : body.error ?? "Something went wrong.");
  };

  useEffect(() => {
    const on = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      const p = max > 0 ? scrollY / max : 0;
      scroll.current = Math.min(1, scrollY / innerHeight);
      setProgress(p);
    };
    on();
    addEventListener("scroll", on, { passive: true });
    return () => removeEventListener("scroll", on);
  }, []);

  return (
    <>
      <ScrollRail progress={progress} />
      <Socials />

      {/* ── Hero ── */}
      <section className="relative flex min-h-[100svh] items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_45%,rgba(47,75,255,.35),transparent_70%)]" />
        <div className="absolute inset-0"><SceneCubes scroll={scroll} /></div>
        <div className="pointer-events-none absolute inset-0 z-[5] bg-[radial-gradient(42%_34%_at_50%_52%,rgba(3,4,12,.72),transparent_80%)]" />
        <div className="pointer-events-none relative z-10 mx-auto max-w-4xl px-6 text-center [text-shadow:0_2px_30px_rgba(3,4,12,.9)]">
          <Eyebrow>Introducing Facet · simulated trading for US stocks</Eyebrow>
          <h1 className="text-5xl leading-[1.02] font-medium tracking-tight sm:text-7xl md:text-[88px]">
            Chart, trade &amp; <br /><span className="accent text-blue-glow">prove your edge</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base text-muted sm:text-lg">
            TradingView-depth charts, a $100K paper account and prop-style challenges, all without risking a single dollar.
          </p>
          <div className="pointer-events-auto mt-9 flex flex-wrap justify-center gap-3">
            <LinkButton href="/signup" size="lg">Start free <ArrowRight size={16} /></LinkButton>
            <LinkButton href="/terminal" size="lg" variant="outline">Open the terminal</LinkButton>
          </div>
        </div>
        <span className="absolute right-8 bottom-8 flex items-center gap-1.5 text-xs text-muted"><ArrowDown size={13} /> Scroll <span className="text-dim">down</span></span>
      </section>

      {/* ── Ticker band ── */}
      <div className="relative overflow-hidden border-y border-line bg-bg-2/60 py-3">
        <div className="animate-ticker flex w-max gap-10">
          {[...quotes, ...quotes].map((q, i) => (
            <span key={i} className="flex items-center gap-2 text-sm">
              <b className="font-medium">{q.symbol}</b>
              <span className="num text-muted">{num(q.price)}</span>
              <span className={cn("num text-xs", q.changePct >= 0 ? "text-up" : "text-down")}>{q.changePct >= 0 ? "+" : ""}{q.changePct.toFixed(2)}%</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Solutions ── */}
      <section id="solutions" className="relative mx-auto max-w-7xl px-6 py-28">
        <div className="mb-14 text-center">
          <Eyebrow>Solutions</Eyebrow>
          <h2 className="text-4xl font-medium tracking-tight sm:text-5xl">Three facets of <span className="accent text-blue-glow">one platform</span></h2>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { icon: <CandlestickChart size={20} />, t: "Pro charting", d: "Candles, bars, line and area charts. Seven timeframes, overlays and oscillators, trend lines and Fibonacci, multi-chart layouts." },
            { icon: <Zap size={20} />, t: "Paper trading", d: "Market, limit, stop and bracket orders on a $100K simulated account, with positions, P&L and an equity curve." },
            { icon: <Flag size={20} />, t: "Trading challenges", d: "Hit a profit target without breaking daily-loss and drawdown rules. Two phases, certificates and a public leaderboard." },
          ].map((c, i) => (
            <Card key={c.t} glow className={cn("p-7", i === 1 && "md:-translate-y-6")}>
              <span className="grid size-11 place-items-center rounded-xl bg-blue/15 text-blue-glow">{c.icon}</span>
              <h3 className="mt-6 text-2xl font-medium">{c.t.split(" ")[0]} <span className="accent">{c.t.split(" ").slice(1).join(" ")}</span></h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">{c.d}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Overview statement ── */}
      <section id="about" className="relative overflow-hidden py-32">
        <div className="absolute top-1/2 left-1/2 -z-10 size-[620px] -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[80px] bg-gradient-to-br from-blue/50 via-blue/15 to-transparent blur-2xl" />
        <div className="mx-auto max-w-4xl px-6 text-center">
          <Eyebrow>Company overview</Eyebrow>
          <p className="text-3xl leading-snug font-light tracking-tight sm:text-[42px]">
            <span className="accent">Facet</span> is the practice floor for traders. A place to build skill, test ideas and earn a track record, <span className="accent text-blue-glow">before real money is on the line.</span>
          </p>
        </div>
      </section>

      {/* ── Terminal preview ── */}
      <section id="terminal" className="relative mx-auto max-w-7xl px-6 py-24">
        <div className="mb-12 text-center">
          <Eyebrow>Why Facet?</Eyebrow>
          <h2 className="text-4xl font-medium tracking-tight sm:text-5xl">Powerful <span className="accent text-blue-glow">trading terminal</span></h2>
        </div>
        <div className="glass glass-glow overflow-hidden p-0 shadow-[0_40px_120px_-40px_rgba(47,75,255,.6)]">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <span className="size-2.5 rounded-full bg-down/70" /><span className="size-2.5 rounded-full bg-warn/70" /><span className="size-2.5 rounded-full bg-up/70" />
            <span className="ml-3 text-xs text-muted">facet.trade/terminal · NVDA</span>
          </div>
          <PriceChart symbol="NVDA" height={420} defaultIndicators={["vol", "sma20", "ema50"]} />
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {[
            { icon: <ShieldCheck size={18} />, t: "Secure", a: "and private", d: "Your data stays in your account, protected by row-level security. We never connect to a broker." },
            { icon: <BarChart3 size={18} />, t: "Deep", a: "analytics", d: "Win rate, profit factor, drawdown and a daily journal for every account and challenge." },
            { icon: <Lock size={18} />, t: "Honest", a: "rules", d: "Daily-loss and drawdown limits are checked live, just like a real funded account." },
          ].map((c) => (
            <Card key={c.t} className="p-6">
              <span className="grid size-10 place-items-center rounded-full border border-line-strong bg-white/[0.04] text-blue-glow">{c.icon}</span>
              <h3 className="mt-5 text-lg">{c.t} <span className="accent">{c.a}</span></h3>
              <p className="mt-2 text-sm text-muted">{c.d}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Challenges ── */}
      <section id="challenges" className="relative overflow-hidden py-28">
        <div className="grid-floor absolute inset-0 [mask-image:radial-gradient(60%_60%_at_50%_50%,#000,transparent)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-6 lg:grid-cols-2">
          <div>
            <Eyebrow>Challenges</Eyebrow>
            <h2 className="text-4xl font-medium tracking-tight sm:text-5xl">Earn a <span className="accent text-blue-glow">track record</span></h2>
            <p className="mt-5 max-w-md text-muted">Pick an account size, follow the rules and pass two phases. Every result is verifiable on a public certificate.</p>
            <ul className="mt-7 space-y-3 text-sm">
              {["Profit target 8–10% in Phase 1", "Max daily loss 4–5%, max drawdown 8–10%", "Minimum 5 trading days, no time limit", "Monthly competitions with Pro prizes"].map((x) => (
                <li key={x} className="flex gap-3"><Check size={16} className="text-blue-glow" />{x}</li>
              ))}
            </ul>
            <LinkButton href="/challenges" className="mt-8">Explore challenges <ArrowRight size={15} /></LinkButton>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card glow>
              <div className="flex items-center justify-between"><span className="text-sm">Profit target</span><Badge tone="up">Target met</Badge></div>
              <p className="num mt-4 text-2xl font-medium">$10,257</p>
              <p className="text-xs text-muted">Current result 10.3%</p>
              <div className="mt-4 h-2 rounded-full bg-blue-2" />
            </Card>
            <Card>
              <div className="flex items-center justify-between"><span className="text-sm">Trading days</span><Badge tone="violet">In progress</Badge></div>
              <p className="num mt-4 text-2xl font-medium">3 / 5</p>
              <p className="text-xs text-muted">Minimum per phase</p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full w-3/5 rounded-full bg-violet" /></div>
            </Card>
            <Card className="sm:col-span-2">
              <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-sm"><Trophy size={15} className="text-warn" /> Monthly competition leaderboard</span><Badge>Example</Badge></div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {[["#1", "+18.4%", "AAPL"], ["#2", "+15.9%", "NVDA"], ["#3", "+14.2%", "MSFT"]].map(([n, r, s]) => (
                  <div key={n} className="rounded-xl border border-line bg-white/[0.02] p-3">
                    <p className="text-xs text-muted">{n}</p>
                    <p className="num text-sm text-up">{r}</p>
                    <Sparkline data={EXAMPLE_SPARK[s]} className="mt-1 h-6 w-full" color="var(--up)" />
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="mx-auto max-w-7xl px-6 py-28">
        <div className="mb-12 text-center">
          <Eyebrow>Pricing</Eyebrow>
          <h2 className="text-4xl font-medium tracking-tight sm:text-5xl">Simple, <span className="accent text-blue-glow">honest pricing</span></h2>
          <p className="mt-4 text-muted">Start free. Upgrade when you want the full toolkit. <Sparkles size={14} className="inline text-blue-glow" /> 14-day Pro trial.</p>
        </div>
        <PricingPlans />
      </section>

      {/* ── Contact ── */}
      <section id="contact" className="relative overflow-hidden pt-20 pb-28">
        <div className="relative mx-auto aspect-square w-full max-w-[640px]">
          <div className="absolute inset-[12%] rounded-full shadow-[0_0_120px_-10px_rgba(77,107,255,.8),inset_0_0_80px_-10px_rgba(139,108,255,.6)]" />
          <div className="absolute inset-0"><SceneGlobe /></div>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <p className="text-xs text-muted">Contact us</p>
            <h2 className="mt-2 text-4xl font-medium tracking-tight sm:text-5xl">How can <span className="accent">we help?</span></h2>
          </div>
        </div>
        {sent === "sent" ? (
          <p className="glass mx-auto -mt-16 max-w-xl p-6 text-center text-sm">Thanks, we got your message and will reply by email.</p>
        ) : (
          <form onSubmit={contact} className="glass mx-auto -mt-16 grid max-w-xl gap-4 p-6 sm:grid-cols-2">
            <Field label="Name"><input name="name" required maxLength={120} placeholder="Your name" className={inputCls} /></Field>
            <Field label="Email"><input name="email" type="email" required placeholder="you@example.com" className={inputCls} /></Field>
            <input name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
            <div className="sm:col-span-2"><Field label="Message"><textarea name="message" required minLength={5} maxLength={5000} rows={4} placeholder="Message…" className={inputCls + " h-auto py-3"} /></Field></div>
            {sent !== "idle" && sent !== "sending" && <p role="alert" className="text-sm text-down sm:col-span-2">{sent}</p>}
            <button disabled={sent === "sending"} className="h-11 rounded-full bg-text text-sm font-medium text-bg hover:opacity-90 disabled:opacity-60 sm:col-span-2">{sent === "sending" ? "Sending…" : "Contact us"}</button>
          </form>
        )}
      </section>
    </>
  );
}
