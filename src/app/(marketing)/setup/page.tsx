import { Card } from "@/components/ui";

export const metadata = { title: "Finish setup" };

export default function SetupPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 pt-36 pb-24">
      <h1 className="text-4xl font-medium tracking-tight">Finish <span className="accent text-blue-glow">setup</span></h1>
      <p className="mt-3 text-muted">Facet needs a Supabase project before you can sign in.</p>
      <Card className="mt-8 space-y-3 text-sm leading-relaxed">
        <p>1. Create a free project at supabase.com and run the SQL in <code className="text-blue-glow">supabase/migrations</code> (or <code className="text-blue-glow">npx supabase db push</code>).</p>
        <p>2. Copy <code className="text-blue-glow">.env.example</code> to <code className="text-blue-glow">.env.local</code> and fill in the Supabase URL, anon key and service-role key.</p>
        <p>3. Restart <code className="text-blue-glow">npm run dev</code>. Market data works without keys (demo prices) until you add Finnhub and Alpaca keys.</p>
        <p className="text-muted">Full steps are in README.md.</p>
      </Card>
    </div>
  );
}
