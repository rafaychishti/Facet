import { Logo } from "@/components/ui";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="relative grid min-h-screen overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="relative z-10 flex flex-col px-6 py-8 sm:px-12">
        <Logo />
        <div className="flex flex-1 items-center">
          <div className="fade-up w-full max-w-sm">{children}</div>
        </div>
        <p className="text-[11px] text-dim">Simulated trading only · no real money</p>
        {/* Planet horizon glow, as in the FXIFY login */}
        <div className="pointer-events-none absolute inset-x-0 -bottom-[118%] -z-10 mx-auto aspect-square w-[150%] -translate-x-[16%] rounded-full bg-bg shadow-[0_-30px_120px_-20px_rgba(77,107,255,.85),inset_0_30px_60px_-30px_rgba(160,180,255,.9)]" />
      </div>
      <div className="relative hidden overflow-hidden border-l border-line lg:block">
        <div className="spot-blue absolute inset-0" />
        <div className="grid-floor absolute inset-0 [mask-image:radial-gradient(70%_60%_at_50%_40%,#000,transparent)]" />
        <div className="relative flex h-full flex-col items-center justify-center p-12 text-center">
          <div className="grid grid-cols-3 gap-3 [transform:perspective(900px)_rotateX(55deg)_rotateZ(-35deg)]">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="size-20 rounded-xl border border-blue-glow/40 shadow-[0_0_40px_-10px_rgba(77,107,255,.9)]"
                style={{ background: `linear-gradient(135deg, rgba(111,139,255,${0.15 + (i % 3) * 0.2}), rgba(47,75,255,${0.05 + (i % 4) * 0.12}))` }} />
            ))}
          </div>
          <h2 className="mt-16 text-3xl font-medium tracking-tight">Chart it. Trade it. <span className="accent text-blue-glow">Prove it.</span></h2>
          <p className="mt-3 max-w-sm text-sm text-muted">Pro-grade charts, a $100K paper account and trading challenges for US stocks.</p>
        </div>
      </div>
    </div>
  );
}
