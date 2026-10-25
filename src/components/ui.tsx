import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/format";

/* ───────────── Brand ───────────── */
export function LogoMark({ className = "size-6" }: { className?: string }) {
  // A cube seen corner-on: three facets
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <defs>
        <linearGradient id="fa" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9fb2ff" />
          <stop offset="1" stopColor="#4d6bff" />
        </linearGradient>
        <linearGradient id="fb" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3550ff" />
          <stop offset="1" stopColor="#1a2ab8" />
        </linearGradient>
      </defs>
      <path d="M16 2 29 9.5 16 17 3 9.5Z" fill="url(#fa)" />
      <path d="M3 9.5 16 17v13L3 22.5Z" fill="url(#fb)" />
      <path d="M29 9.5 16 17v13l13-7.5Z" fill="#2a3ee0" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2 font-semibold tracking-tight", className)}>
      <LogoMark />
      <span className="text-[17px]">Facet</span>
    </Link>
  );
}

/* ───────────── Surfaces ───────────── */
export function Card({ className, children, glow, ...rest }: ComponentProps<"div"> & { glow?: boolean }) {
  return (
    <div className={cn("glass p-5", glow && "glass-glow", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, icon, action, sub }: { title: ReactNode; icon?: ReactNode; action?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-center gap-2.5">
        {icon && <span className="grid size-8 place-items-center rounded-lg bg-blue/15 text-blue-glow">{icon}</span>}
        <div>
          <h3 className="text-[15px] font-medium text-text">{title}</h3>
          {sub && <p className="text-xs text-muted">{sub}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

/* ───────────── Badges & buttons ───────────── */
const badgeTones = {
  blue: "bg-blue/15 text-blue-glow border-blue/30",
  violet: "bg-violet/15 text-violet border-violet/30",
  up: "bg-up/12 text-up border-up/30",
  down: "bg-down/12 text-down border-down/30",
  warn: "bg-warn/12 text-warn border-warn/30",
  neutral: "bg-white/5 text-muted border-line",
};
export type Tone = keyof typeof badgeTones;

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap", badgeTones[tone], className)}>
      {children}
    </span>
  );
}

export const statusTone = (s: string): Tone =>
  ({ "In progress": "violet", Passed: "up", "Target met": "up", Failed: "down", Live: "up", Upcoming: "blue", Ended: "neutral", Active: "up", Triggered: "blue", Paused: "neutral", Simulated: "violet", filled: "up", working: "blue", cancelled: "neutral" } as Record<string, Tone>)[s] ?? "neutral";

type BtnProps = { variant?: "primary" | "ghost" | "outline"; size?: "sm" | "md" | "lg"; className?: string; children: ReactNode };
const btnBase = "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition disabled:opacity-50 whitespace-nowrap";
const btnVariant = {
  primary: "btn-primary text-white",
  ghost: "text-muted hover:text-text hover:bg-white/5",
  outline: "border border-line-strong bg-white/[0.03] text-text hover:bg-white/[0.07]",
};
const btnSize = { sm: "h-8 px-3 text-xs", md: "h-10 px-4 text-sm", lg: "h-12 px-6 text-[15px]" };

export function Button({ variant = "primary", size = "md", className, children, ...rest }: BtnProps & Omit<ComponentProps<"button">, "children">) {
  return (
    <button className={cn(btnBase, btnVariant[variant], btnSize[size], className)} {...rest}>
      {children}
    </button>
  );
}

export function LinkButton({ href, variant = "primary", size = "md", className, children }: BtnProps & { href: string }) {
  return (
    <Link href={href} className={cn(btnBase, btnVariant[variant], btnSize[size], className)}>
      {children}
    </Link>
  );
}

/* ───────────── Data bits ───────────── */
export function Change({ value, pctMode = true, className }: { value: number; pctMode?: boolean; className?: string }) {
  const up = value >= 0;
  return (
    <span className={cn("num font-medium", up ? "text-up" : "text-down", className)}>
      {up ? "▲" : "▼"} {pctMode ? `${Math.abs(value).toFixed(2)}%` : Math.abs(value).toFixed(2)}
    </span>
  );
}

export function Sparkline({ data, className = "h-8 w-24", color }: { data: number[]; className?: string; color?: string }) {
  const min = Math.min(...data), max = Math.max(...data);
  const up = data[data.length - 1] >= data[0];
  const c = color ?? (up ? "var(--up)" : "var(--down)");
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${30 - ((v - min) / (max - min || 1)) * 28 - 1}`).join(" ");
  const id = `sg${Math.round(data[0] * 1000)}${data.length}`;
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={className} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c} stopOpacity="0.3" />
          <stop offset="1" stopColor={c} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,30 ${pts} 100,30`} fill={`url(#${id})`} />
      <polyline points={pts} fill="none" stroke={c} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function Progress({ value, tone = "blue", striped }: { value: number; tone?: "blue" | "up" | "down" | "violet"; striped?: boolean }) {
  const bg = { blue: "bg-blue-2", up: "bg-up", down: "bg-down", violet: "bg-violet" }[tone];
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]"
      style={striped ? { backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,.05) 0 6px, transparent 6px 12px)" } : undefined}
    >
      <div className={cn("h-full rounded-full", bg)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function PageHeader({ title, accent, sub, icon, actions }: { title: string; accent?: string; sub?: ReactNode; icon?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="flex items-center gap-4">
        {icon && <span className="grid size-12 place-items-center rounded-full border border-line-strong bg-blue/15 text-blue-glow shadow-[0_0_30px_-6px_rgba(47,75,255,.7)]">{icon}</span>}
        <div>
          <h1 className="text-2xl font-medium tracking-tight sm:text-[28px]">
            {title} {accent && <span className="accent text-blue-glow">{accent}</span>}
          </h1>
          {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Kv({ k, v, className }: { k: ReactNode; v: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 py-2 text-sm", className)}>
      <span className="text-muted">{k}</span>
      <span className="num text-text">{v}</span>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-dim">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "h-11 w-full rounded-xl border border-line bg-white/[0.03] px-3.5 text-sm text-text placeholder:text-dim outline-none transition focus:border-blue-2 focus:bg-white/[0.05] focus:ring-2 focus:ring-blue/30";

/* ───────────── States ───────────── */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-white/[0.05]", className)} />;
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {icon && <span className="mb-4 grid size-12 place-items-center rounded-2xl border border-line-strong bg-blue/10 text-blue-glow">{icon}</span>}
      <p className="font-medium">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorNote({ error, className }: { error?: { message: string } | null; className?: string }) {
  if (!error) return null;
  return <p role="alert" className={cn("rounded-xl border border-down/30 bg-down/10 px-4 py-3 text-sm text-down", className)}>{error.message}</p>;
}
