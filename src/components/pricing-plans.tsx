import { Check, Sparkles } from "lucide-react";
import { Badge, Card, LinkButton } from "./ui";
import { cn } from "@/lib/format";

export const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    blurb: "Everything you need to learn the markets.",
    cta: "Get started free",
    features: ["Charts with 3 indicators at once", "1 watchlist · 20 symbols", "Paper trading · $100K account", "Starter challenge ($25K)", "3 price alerts", "Market news"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$20",
    period: "per month",
    blurb: "TradingView-depth tools and every challenge.",
    cta: "Start 14-day free trial",
    features: ["Unlimited indicators & drawing tools", "Multi-chart layouts, saved", "Unlimited watchlists & alerts", "All challenges + competitions", "Advanced analytics & journal", "Certificates & public profile", "Screener on 600+ symbols"],
  },
];

export function PricingPlans({ ctaHref = "/signup" }: { ctaHref?: string }) {
  return (
    <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
      {PLANS.map((p) => {
        const pro = p.id === "pro";
        return (
          <Card key={p.id} glow={pro} className={cn("flex flex-col p-7", pro && "bg-blue/[0.07]")}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">{p.name}</h3>
              {pro && <Badge tone="blue"><Sparkles size={11} /> 14-day trial</Badge>}
            </div>
            <p className="mt-2 text-sm text-muted">{p.blurb}</p>
            <p className="mt-6 flex items-baseline gap-2"><span className="num text-5xl font-medium tracking-tight">{p.price}</span><span className="text-sm text-muted">{p.period}</span></p>
            {pro && <p className="mt-1 text-xs text-blue-glow">or $192/year (save 20%)</p>}
            <ul className="mt-6 flex-1 space-y-3 text-sm">
              {p.features.map((f) => (
                <li key={f} className="flex gap-2.5"><Check size={16} className={pro ? "text-blue-glow" : "text-muted"} />{f}</li>
              ))}
            </ul>
            <LinkButton href={ctaHref} variant={pro ? "primary" : "outline"} size="lg" className="mt-7 w-full">{p.cta}</LinkButton>
          </Card>
        );
      })}
    </div>
  );
}
