import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Skeleton } from "@/components/ui";
import { normalizeSymbol, SYMBOL_RE, UNIVERSE } from "@/lib/market/universe";
import { SymbolView } from "./symbol-view";

export function generateStaticParams() {
  return UNIVERSE.map((t) => ({ ticker: t.symbol }));
}

export async function generateMetadata({ params }: PageProps<"/symbol/[ticker]">) {
  const { ticker } = await params;
  return { title: `${decodeURIComponent(ticker).toUpperCase()} stock price & chart` };
}

async function Resolve({ params }: { params: PageProps<"/symbol/[ticker]">["params"] }) {
  const { ticker } = await params;
  const symbol = normalizeSymbol(decodeURIComponent(ticker));
  if (!SYMBOL_RE.test(symbol)) notFound();
  return <SymbolView symbol={symbol} />;
}

export default function SymbolPage({ params }: PageProps<"/symbol/[ticker]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[600px] w-full" />}>
      <Resolve params={params} />
    </Suspense>
  );
}
