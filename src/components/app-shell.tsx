"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Bell, BarChart3, Award, CandlestickChart, ChevronDown, CircleHelp, CreditCard, Gift, LayoutGrid,
  LineChart, Menu, MessagesSquare, Rocket, Search, Siren, Trophy, User, Wallet, X, Briefcase, Flag,
} from "lucide-react";
import { Logo } from "./ui";
import { cn } from "@/lib/format";
import { UNIVERSE } from "@/lib/market/universe";
import { api, refresh, useMe, useQuotes, useSearch, type Me } from "@/lib/hooks";

const NAV: { label: string; items: { href: string; label: string; icon: ReactNode }[] }[] = [
  {
    label: "Menu",
    items: [
      { href: "/overview", label: "Overview", icon: <LayoutGrid size={17} /> },
      { href: "/terminal", label: "Terminal", icon: <CandlestickChart size={17} /> },
      { href: "/markets", label: "Markets", icon: <LineChart size={17} /> },
      { href: "/portfolio", label: "Paper Portfolio", icon: <Briefcase size={17} /> },
      { href: "/alerts", label: "Alerts", icon: <Siren size={17} /> },
    ],
  },
  {
    label: "Challenges",
    items: [
      { href: "/challenges", label: "Challenges", icon: <Flag size={17} /> },
      { href: "/challenges/analytics", label: "Analytics", icon: <BarChart3 size={17} /> },
      { href: "/leaderboard", label: "Leaderboard", icon: <Trophy size={17} /> },
      { href: "/certificates", label: "Certificates", icon: <Award size={17} /> },
      { href: "/payouts", label: "Payouts", icon: <Wallet size={17} /> },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/billing", label: "Billing", icon: <CreditCard size={17} /> },
      { href: "/affiliate", label: "Affiliate Program", icon: <Gift size={17} /> },
      { href: "/profile", label: "Profile", icon: <User size={17} /> },
    ],
  },
];

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  const isActive = (href: string) => path === href || (href !== "/challenges" && path.startsWith(href + "/"));
  return (
    <div className="flex h-full flex-col gap-5 p-4">
      <div className="px-2 pt-1">
        <Logo />
      </div>
      <Link href="/challenges" onClick={onNavigate} className="btn-primary flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-medium text-white">
        <Rocket size={16} /> Start Challenge
      </Link>
      <nav className="flex-1 space-y-5 overflow-y-auto pr-1">
        {NAV.map((g) => (
          <div key={g.label}>
            <p className="mb-1.5 px-3 text-[11px] font-medium tracking-[0.12em] text-dim uppercase">{g.label}</p>
            <ul className="space-y-0.5">
              {g.items.map((it) => {
                const active = isActive(it.href);
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] transition",
                        active ? "glass-glow relative bg-blue/12 text-text" : "text-muted hover:bg-white/[0.04] hover:text-text",
                      )}
                    >
                      <span className={active ? "text-blue-glow" : ""}>{it.icon}</span>
                      {it.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="space-y-0.5 border-t border-line pt-3">
        <Link href="/help" onClick={onNavigate} className="flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] text-muted hover:bg-white/[0.04] hover:text-text">
          <CircleHelp size={17} /> Help Center
        </Link>
        <a href="#" className="flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] text-muted hover:bg-white/[0.04] hover:text-text">
          <MessagesSquare size={17} /> Community
        </a>
      </div>
    </div>
  );
}

function SymbolSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const { data, isLoading } = useSearch(q);
  const results = q.trim() ? data?.results ?? [] : UNIVERSE.slice(0, 6).map((u) => ({ symbol: u.symbol, name: u.name, exchange: u.exchange }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (s: string) => {
    setOpen(false);
    setQ("");
    ref.current?.blur();
    router.push(`/symbol/${encodeURIComponent(s)}`);
  };

  return (
    <div className="relative w-full max-w-md">
      <Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-dim" />
      <input
        ref={ref}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const exact = q.trim().toUpperCase();
            if (results[0]) go(results[0].symbol);
            else if (/^[A-Z][A-Z.\-]{0,9}$/.test(exact)) go(exact);
          }
          if (e.key === "Escape") ref.current?.blur();
        }}
        placeholder="Search AAPL, Tesla…"
        aria-label="Search symbols"
        className="h-10 w-full rounded-xl border border-line bg-white/[0.03] pr-14 pl-10 text-sm outline-none placeholder:text-dim focus:border-blue-2"
      />
      <kbd className="absolute top-1/2 right-3 hidden -translate-y-1/2 rounded-md border border-line px-1.5 py-0.5 text-[10px] text-dim sm:block">Ctrl K</kbd>
      {open && (
        <div className="glass absolute top-12 right-0 left-0 z-50 overflow-hidden p-1.5">
          {!q.trim() && <p className="px-3 pt-1 pb-1.5 text-[11px] text-dim">Popular</p>}
          {results.map((t) => (
            <button key={t.symbol} onMouseDown={() => go(t.symbol)} className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-white/[0.05]">
              <span className="flex min-w-0 items-center gap-3">
                <span className="w-14 shrink-0 font-medium">{t.symbol}</span>
                <span className="truncate text-muted">{t.name}</span>
              </span>
              <span className="shrink-0 text-[11px] text-dim">{t.exchange ?? "US"}</span>
            </button>
          ))}
          {q.trim() && !isLoading && results.length === 0 && <p className="px-3 py-3 text-sm text-muted">No US stocks match “{q}”.</p>}
        </div>
      )}
    </div>
  );
}

const ago = (iso: string) => {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  return m < 1 ? "now" : m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`;
};

function Notifications({ me }: { me?: Me }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const toggle = async () => {
    setOpen((o) => !o);
    if (!open && me?.unread) {
      await api("POST", "/api/notifications").catch(() => {});
      refresh("/api/me");
    }
  };
  return (
    <div className="relative">
      <button onClick={toggle} className="relative grid size-10 place-items-center rounded-xl border border-line text-muted hover:text-text" aria-label={`Notifications${me?.unread ? ` (${me.unread} unread)` : ""}`}>
        <Bell size={17} />
        {!!me?.unread && <span className="absolute top-2 right-2.5 size-1.5 rounded-full bg-down" />}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="glass absolute top-12 right-0 z-50 max-h-[70vh] w-80 overflow-y-auto p-2">
            <p className="px-2 py-1.5 text-xs font-medium text-muted">Notifications</p>
            {(me?.notifications ?? []).map((n) => (
              <button key={n.id} onClick={() => { setOpen(false); if (n.link) router.push(n.link); }} className="flex w-full gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-white/[0.04]">
                <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", n.tone === "warn" ? "bg-warn" : n.tone === "ok" ? "bg-up" : n.tone === "error" ? "bg-down" : "bg-blue-glow")} />
                <span className={cn("flex-1 text-[13px] leading-snug", n.read_at && "text-muted")}>{n.text}</span>
                <span className="text-[11px] text-dim">{ago(n.created_at)}</span>
              </button>
            ))}
            {me && me.notifications.length === 0 && <p className="px-2 py-4 text-sm text-muted">You&apos;re all caught up.</p>}
          </div>
        </>
      )}
    </div>
  );
}

function UserMenu({ me }: { me?: Me }) {
  const [open, setOpen] = useState(false);
  const name = me?.profile?.full_name || me?.email?.split("@")[0] || "";
  const initials = name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "··";
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex h-10 items-center gap-2 rounded-xl border border-line pr-3 pl-1.5 text-sm hover:bg-white/[0.04]" aria-label="Account menu">
        <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-blue-2 to-violet text-xs font-semibold">{initials}</span>
        <span className="hidden max-w-28 truncate sm:inline">{name.split(" ")[0]}</span>
        <ChevronDown size={13} className="text-dim" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="glass absolute top-12 right-0 z-50 w-56 p-1.5 text-sm">
            <div className="border-b border-line px-3 py-2">
              <p className="truncate font-medium">{name}</p>
              <p className="truncate text-xs text-muted">{me?.email}</p>
            </div>
            <Link href="/profile" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 hover:bg-white/[0.05]">Profile & settings</Link>
            <Link href="/billing" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 hover:bg-white/[0.05]">Billing · <span className="text-blue-glow">{me?.plan === "pro" ? "Pro" : "Free"}</span></Link>
            <form action="/auth/signout" method="post">
              <button className="w-full rounded-lg px-3 py-2 text-left text-down hover:bg-down/10">Sign out</button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  const { data: me } = useMe();
  const { source } = useQuotes(["SPY"], 60_000);
  return (
    <div className="relative flex min-h-screen">
      <div className="spot-blue pointer-events-none fixed inset-x-0 top-0 h-[480px] opacity-60" />
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-line bg-bg-2/60 backdrop-blur-xl lg:block">
        <Sidebar />
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-line bg-bg-2">
            <button className="absolute top-4 right-4 text-muted" onClick={() => setDrawer(false)} aria-label="Close menu">
              <X size={20} />
            </button>
            <Sidebar onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-line bg-bg/70 px-4 backdrop-blur-xl sm:px-6">
          <button className="text-muted lg:hidden" onClick={() => setDrawer(true)} aria-label="Open menu">
            <Menu size={22} />
          </button>
          <SymbolSearch />
          <div className="ml-auto flex items-center gap-2">
            {source === "demo" && <span title="No market-data keys configured: prices are simulated" className="hidden rounded-full border border-warn/30 bg-warn/10 px-2.5 py-1 text-[11px] text-warn md:inline">Demo prices</span>}
            {me?.trialDaysLeft != null && <Link href="/billing" className="hidden rounded-full border border-violet/30 bg-violet/10 px-2.5 py-1 text-[11px] text-violet xl:inline">Pro trial · {me.trialDaysLeft} days left</Link>}
            {me?.plan === "free" && <Link href="/billing" className="hidden rounded-full border border-blue/30 bg-blue/10 px-2.5 py-1 text-[11px] text-blue-glow xl:inline">Upgrade to Pro</Link>}
            <Notifications me={me} />
            <UserMenu me={me} />
          </div>
        </header>
        <main className="relative mx-auto w-full max-w-[1500px] flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        <footer className="border-t border-line px-6 py-4 text-[11px] leading-relaxed text-dim">
          © 2026 Facet. Simulated trading only. Facet does not execute real trades, hold funds or give investment advice. Market data may be delayed.
        </footer>
      </div>
    </div>
  );
}
