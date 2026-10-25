"use client";

import Link from "next/link";
import { Info, Wallet } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, Kv, LinkButton, PageHeader, Skeleton } from "@/components/ui";
import { usePayouts } from "@/lib/hooks";
import { usd } from "@/lib/format";

export default function PayoutsPage() {
  const { data, isLoading } = usePayouts();
  const total = data?.payouts.reduce((a, p) => a + Number(p.amount), 0) ?? 0;
  return (
    <div className="fade-up space-y-6">
      <PageHeader icon={<Wallet size={20} />} title="Simulated" accent="payouts" sub="What your funded-stage profits would have paid out." />
      <div className="flex items-start gap-3 rounded-2xl border border-blue/30 bg-blue/10 px-5 py-4 text-sm">
        <Info size={18} className="mt-0.5 shrink-0 text-blue-glow" />
        <p className="text-muted"><b className="font-medium text-text">Facet never pays out real money.</b> Payouts are a scorekeeping feature: once you pass both phases, every 14 days you can record the 80% profit split you would have earned. The profit then leaves the simulated account, like a real withdrawal.</p>
      </div>
      {isLoading && <Skeleton className="h-48" />}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card glow className="lg:col-span-1">
          <CardHeader title="Funded accounts" />
          {data && data.funded.length === 0 && <EmptyState title="No funded accounts yet" body="Pass Phase 1 and Phase 2 of a challenge to unlock payouts." action={<LinkButton href="/challenges" size="sm">View challenges</LinkButton>} />}
          {data?.funded.map((f) => (
            <Link key={f.challengeId} href={`/challenges/${f.challengeId}`} className="mb-2 block rounded-xl border border-line bg-white/[0.02] p-4 hover:border-line-strong">
              <div className="flex justify-between text-sm"><span className="font-medium">{f.publicId}</span><Badge tone={f.eligible ? "up" : "neutral"}>{f.eligible ? "Eligible" : "Not yet"}</Badge></div>
              <p className="num mt-2 text-2xl text-blue-glow">{usd(f.amount)}</p>
              {!f.eligible && <p className="mt-1 text-xs text-muted">{f.reasons[0]}</p>}
            </Link>
          ))}
        </Card>
        <Card>
          <CardHeader title="Totals" />
          <div className="divide-y divide-line">
            <Kv k="Simulated payouts" v={data?.payouts.length ?? "—"} />
            <Kv k="Total recorded" v={usd(total)} />
            <Kv k="Profit split" v="80%" />
            <Kv k="Cycle" v="Every 14 days" />
          </div>
        </Card>
        <Card>
          <CardHeader title="History" />
          {data && data.payouts.length === 0 && <p className="text-sm text-muted">No payouts recorded yet.</p>}
          <div className="divide-y divide-line">
            {data?.payouts.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-3 text-sm">
                <div><p className="font-medium">{p.code}</p><p className="text-xs text-muted">{new Date(p.created_at).toLocaleDateString()} · {p.challenge?.public_id}</p></div>
                <div className="text-right"><p className="num">{usd(p.amount)}</p><Badge tone="violet">Simulated</Badge></div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
