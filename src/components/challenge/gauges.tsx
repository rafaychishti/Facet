"use client";

import { useEffect, useState } from "react";
import { CLOSE_MIN, nyParts } from "@/lib/market/hours";

export function Countdown() {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    // seconds until the next 4:00 PM New York close (handles EST/EDT automatically)
    const tick = () => {
      const now = new Date();
      const { minutes } = nyParts(now);
      let secs = (CLOSE_MIN - minutes) * 60 - now.getSeconds();
      if (secs <= 0) secs += 86400;
      setLeft(secs);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  const s = left ?? 0;
  const parts = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, "0"));
  const frac = 1 - s / 86400;
  const r = 46, c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center">
      <div className="relative size-44">
        <svg viewBox="0 0 110 110" className="size-full -rotate-90">
          <circle cx="55" cy="55" r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="4" />
          <circle cx="55" cy="55" r={r} fill="none" stroke="url(#cg)" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${c * frac} ${c}`} />
          <defs><linearGradient id="cg"><stop offset="0" stopColor="#4d6bff" /><stop offset="1" stopColor="#8b6cff" /></linearGradient></defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] text-muted">Time remaining</span>
          <span className="num mt-1 text-2xl font-medium">{left === null ? "--:--:--" : parts.join(" : ")}</span>
          <span className="mt-0.5 flex gap-4 text-[9px] text-dim"><span>hours</span><span>min</span><span>sec</span></span>
          <span className="mt-2 text-[10px] text-muted">Resets at 4 PM ET</span>
        </div>
      </div>
      <p className="mt-2 text-xs text-blue-glow">EOD drawdown reset time</p>
    </div>
  );
}

export function DaysGauge({ done, min }: { done: number; min: number }) {
  const steps = Array.from({ length: min }, (_, i) => i);
  const angle = (i: number) => Math.PI - (i / (min - 1)) * Math.PI;
  const R = 80, cx = 100, cy = 95;
  const arcEnd = angle(Math.max(0, Math.min(done, min) - 1));
  return (
    <div className="relative mx-auto w-full max-w-[260px]">
      <svg viewBox="0 0 200 120" className="w-full">
        <path d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="14" strokeLinecap="round" />
        {done > 0 && <path d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R * Math.cos(arcEnd)} ${cy - R * Math.sin(arcEnd)}`} fill="none" stroke="url(#dg)" strokeWidth="14" strokeLinecap="round" />}
        <defs><linearGradient id="dg"><stop offset="0" stopColor="#2f4bff" /><stop offset="1" stopColor="#6f8bff" /></linearGradient></defs>
        {steps.map((i) => {
          const a = angle(i);
          const x = cx + R * Math.cos(a), y = cy - R * Math.sin(a);
          const ok = i < done;
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="8" fill={ok ? "#2f4bff" : "#0e1230"} stroke={ok ? "#9fb2ff" : "rgba(124,140,255,.35)"} strokeWidth="1.5" />
              {ok ? <path d={`M ${x - 3} ${y} l 2 2.2 l 4 -4.4`} stroke="white" strokeWidth="1.6" fill="none" /> : <text x={x} y={y + 3} textAnchor="middle" fontSize="8" fill="#8b91b8">⧗</text>}
            </g>
          );
        })}
      </svg>
      <div className="absolute inset-x-0 bottom-1 flex flex-col items-center">
        <span className="text-[11px] text-muted">Day</span>
        <span className="num grid size-9 place-items-center rounded-full border border-line-strong bg-blue/20 text-sm font-medium">{done}</span>
      </div>
      <div className="flex justify-between px-1 text-[11px] text-muted"><span>Start</span><span>Finish</span></div>
    </div>
  );
}

