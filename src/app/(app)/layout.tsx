import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";

/** Everything behind login is client-rendered from the API, so the shell streams in. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg" />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
