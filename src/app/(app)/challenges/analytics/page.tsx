"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { EmptyState, LinkButton, Skeleton } from "@/components/ui";
import { useChallenges } from "@/lib/hooks";

/** Sidebar shortcut: jump to the most recent active challenge's analytics. */
export default function AnalyticsShortcut() {
  const router = useRouter();
  const { data } = useChallenges();
  const target = data?.challenges.find((c) => c.status === "active") ?? data?.challenges[0];
  useEffect(() => {
    if (target) router.replace(`/challenges/${target.id}`);
  }, [target, router]);
  if (!data || target) return <Skeleton className="h-96 w-full" />;
  return <EmptyState icon={<BarChart3 size={18} />} title="No challenges yet" body="Analytics appear once you start a challenge." action={<LinkButton href="/challenges">Pick a challenge</LinkButton>} />;
}
