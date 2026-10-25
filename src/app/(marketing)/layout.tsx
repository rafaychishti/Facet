import Link from "next/link";
import { ChevronDown, Globe, LogIn } from "lucide-react";
import { Logo } from "@/components/ui";

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="relative">
      <header className="fixed inset-x-0 top-0 z-40">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-8 px-6">
          <Logo />
          <nav className="hidden items-center gap-7 text-[13px] text-muted md:flex">
            <Link href="/#solutions" className="hover:text-text">Solutions</Link>
            <Link href="/#terminal" className="hover:text-text">Terminal</Link>
            <Link href="/#challenges" className="hover:text-text">Challenges</Link>
            <Link href="/pricing" className="hover:text-text">Pricing</Link>
            <Link href="/#contact" className="hover:text-text">Contact</Link>
          </nav>
          <div className="ml-auto flex items-center gap-2 text-[13px]">
            <button className="hidden items-center gap-1 rounded-full px-3 py-1.5 text-muted hover:text-text sm:flex"><Globe size={14} /> English <ChevronDown size={12} /></button>
            <Link href="/login" className="flex items-center gap-1.5 rounded-full border border-line bg-white/[0.04] px-3.5 py-1.5 hover:bg-white/[0.08]"><LogIn size={13} /> Log in</Link>
            <Link href="/signup" className="btn-primary rounded-full px-4 py-1.5 font-medium text-white">Sign up →</Link>
          </div>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-6 px-6 py-8 text-xs text-muted">
          <Logo />
          <span>© 2026 Facet</span>
          <nav className="ml-auto flex flex-wrap gap-5">
            {["Affiliate", "Terms", "Privacy", "Risk disclaimer", "FAQ", "Contact"].map((l) => <a key={l} href="#" className="hover:text-text">{l}</a>)}
          </nav>
          <p className="w-full text-[11px] leading-relaxed text-dim">
            Facet is a simulated trading platform for education and entertainment. No real trades are executed and no funds are held. Nothing on this site is investment advice. Market data provided by Finnhub and Alpaca; charts by TradingView Lightweight Charts™.
          </p>
        </div>
      </footer>
    </div>
  );
}
