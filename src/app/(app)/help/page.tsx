import { BookOpen, CircleHelp, Flag, Mail, Search } from "lucide-react";
import { Card, CardHeader, PageHeader, inputCls } from "@/components/ui";

export const metadata = { title: "Help Center" };

const FAQ = [
  ["Is any of this real money?", "No. Facet is a simulator. Paper trades, challenges and payouts are all simulated, and Facet never holds funds or sends orders to a broker."],
  ["Where does market data come from?", "Live prices and chart history come from Alpaca's IEX feed; news, company profiles and search come from Finnhub. Prices can lag the consolidated tape slightly. US stocks and ETFs only."],
  ["When do my orders fill?", "Market orders fill instantly during regular US market hours (9:30 AM to 4:00 PM ET). Limit and stop orders are checked every 20 seconds and fill when the price reaches them. Orders placed while the market is closed wait for the next open."],
  ["How is the daily loss limit calculated?", "From your equity at the last 4:00 PM ET close. If equity falls more than the daily limit (a % of the phase's starting balance) below that level at any time, the challenge ends. Max drawdown is measured from the phase's starting balance."],
  ["What counts as a trading day?", "Any US market day on which at least one of your orders fills."],
  ["How do I cancel my trial?", "Billing → Manage subscription. You won't be charged if you cancel before the trial ends."],
  ["Can I short stocks?", "Not yet. Facet works like a cash account: you can buy, and sell shares you own."],
];

export default function HelpPage() {
  return (
    <div className="fade-up space-y-6">
      <PageHeader icon={<CircleHelp size={20} />} title="Help" accent="center" />
      <div className="relative max-w-xl">
        <Search size={16} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-dim" />
        <input placeholder="Search articles" className={inputCls + " pl-10"} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[[<BookOpen key="b" size={16} />, "Getting started", "Charts, watchlists and your paper account"], [<Flag key="f" size={16} />, "Challenges", "Rules, phases, certificates"], [<Mail key="m" size={16} />, "Contact support", "We reply within one business day"]].map(([i, t, d]) => (
          <Card key={t as string}><CardHeader title={t} icon={i} sub={d} /></Card>
        ))}
      </div>
      <Card>
        <CardHeader title="Frequently asked questions" />
        <div className="divide-y divide-line">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group py-3">
              <summary className="cursor-pointer list-none text-sm font-medium marker:hidden">{q}<span className="float-right text-dim transition group-open:rotate-45">+</span></summary>
              <p className="mt-2 text-sm text-muted">{a}</p>
            </details>
          ))}
        </div>
      </Card>
      <Card glow className="flex flex-wrap items-center justify-between gap-4">
        <div><h3 className="font-medium">Still stuck?</h3><p className="text-sm text-muted">Send us a message and attach a screenshot.</p></div>
        <a href="mailto:support@facet.trade" className="btn-primary inline-flex h-10 items-center rounded-xl px-4 text-sm font-medium text-white">Contact support</a>
      </Card>
    </div>
  );
}
