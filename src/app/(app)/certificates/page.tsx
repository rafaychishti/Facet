"use client";

import { Award, Download } from "lucide-react";
import { Button, Card, EmptyState, LinkButton, LogoMark, PageHeader, Skeleton } from "@/components/ui";
import { useCertificates, type Certificate } from "@/lib/hooks";

/** Draws the certificate onto a canvas and downloads it as a PNG. */
function download(c: Certificate) {
  const W = 1600, H = 1130;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const g = cv.getContext("2d")!;
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0b1140");
  bg.addColorStop(0.5, "#070a24");
  bg.addColorStop(1, "#03040c");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W / 2, 0, 0, W / 2, 0, 900);
  glow.addColorStop(0, "rgba(47,75,255,0.45)");
  glow.addColorStop(1, "rgba(47,75,255,0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);
  g.strokeStyle = "rgba(124,140,255,0.35)";
  g.lineWidth = 2;
  g.strokeRect(40, 40, W - 80, H - 80);
  g.fillStyle = "#e9ecff";
  g.font = "600 44px system-ui, sans-serif";
  g.fillText("Facet", 110, 150);
  g.fillStyle = "#8b91b8";
  g.font = "500 26px system-ui, sans-serif";
  g.fillText("CERTIFICATE OF ACHIEVEMENT", 110, 560);
  g.fillStyle = "#ffffff";
  g.font = "italic 110px 'Instrument Serif', Georgia, serif";
  g.fillText(c.title, 105, 690);
  g.fillStyle = "#8b91b8";
  g.font = "32px system-ui, sans-serif";
  g.fillText(`Awarded to ${c.holder_name} · ${c.detail}`, 110, 770);
  g.font = "24px system-ui, sans-serif";
  g.fillStyle = "#5a6088";
  g.fillText(new Date(c.issued_at).toDateString(), 110, H - 120);
  g.fillText(`ID ${c.code} · simulated trading achievement`, W - 640, H - 120);
  const a = document.createElement("a");
  a.href = cv.toDataURL("image/png");
  a.download = `facet-${c.code}.png`;
  a.click();
}

export default function CertificatesPage() {
  const { data, isLoading } = useCertificates();
  return (
    <div className="fade-up space-y-6">
      <PageHeader icon={<Award size={20} />} title="Your" accent="certificates" sub="Earned by passing challenge phases. Each one has a unique ID." />
      {isLoading && <div className="grid gap-6 md:grid-cols-3"><Skeleton className="h-72" /><Skeleton className="h-72" /><Skeleton className="h-72" /></div>}
      {data && data.certificates.length === 0 && (
        <Card><EmptyState icon={<Award size={18} />} title="No certificates yet" body="Pass Phase 1 of any challenge to earn your first one." action={<LinkButton href="/challenges">Start a challenge</LinkButton>} /></Card>
      )}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {data?.certificates.map((c) => (
          <Card key={c.id} glow className="overflow-hidden p-0">
            <div className="relative aspect-[1.414] overflow-hidden border-b border-line bg-gradient-to-br from-[#0b1140] via-[#070a24] to-[#03040c] p-6">
              <div className="spot-blue absolute inset-0" />
              <div className="grid-floor absolute inset-0 opacity-40" />
              <div className="relative flex h-full flex-col">
                <div className="flex items-center gap-2 text-sm font-medium"><LogoMark className="size-5" /> Facet</div>
                <p className="mt-auto text-[10px] tracking-[0.25em] text-muted uppercase">Certificate of achievement</p>
                <p className="accent mt-1 text-3xl text-text">{c.title}</p>
                <p className="mt-2 text-xs text-muted">Awarded to <span className="text-text">{c.holder_name}</span> · {c.detail}</p>
                <div className="mt-4 flex items-center justify-between text-[10px] text-dim"><span>{new Date(c.issued_at).toLocaleDateString()}</span><span>ID {c.code}</span></div>
              </div>
            </div>
            <div className="p-4">
              <Button variant="outline" size="sm" className="w-full" onClick={() => download(c)}><Download size={14} /> Download PNG</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
