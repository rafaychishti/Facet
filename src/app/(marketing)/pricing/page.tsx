import { PricingPlans } from "@/components/pricing-plans";
import { Card } from "@/components/ui";

export const metadata = { title: "Pricing" };

const FAQ = [
  ["Do I need a card for the trial?", "Yes. Card details are taken at checkout, and you are only charged if you keep Pro after 14 days."],
  ["Can I cancel any time?", "Yes, from Billing. You keep Pro until the end of the period you paid for."],
  ["Is there real money involved in challenges?", "No. Challenges, payouts and competitions are simulated. Pro is the only thing you pay for."],
];

export default function PricingPage() {
  return (
    <div className="relative px-6 pt-36 pb-28">
      <div className="spot-blue pointer-events-none absolute inset-x-0 top-0 h-[500px]" />
      <div className="relative mb-12 text-center">
        <h1 className="text-5xl font-medium tracking-tight">Choose your <span className="accent text-blue-glow">plan</span></h1>
        <p className="mt-4 text-muted">Free forever, or unlock everything with Pro.</p>
      </div>
      <PricingPlans />
      <div className="mx-auto mt-16 max-w-3xl space-y-3">
        {FAQ.map(([q, a]) => (
          <Card key={q} className="py-4"><p className="font-medium">{q}</p><p className="mt-1 text-sm text-muted">{a}</p></Card>
        ))}
      </div>
    </div>
  );
}
