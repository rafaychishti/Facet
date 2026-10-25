"use client";

import { useEffect, useRef } from "react";
import { createChart, ColorType, LineSeries, AreaSeries, LineStyle, type Time } from "lightweight-charts";

export type LineDef = {
  name: string;
  color: string;
  data: { time: string; value: number }[]; // time as "YYYY-MM-DD"
  area?: boolean;
};

/** Generic multi-line chart (equity curves, challenge stats) with optional reference levels. */
export function LineChart({
  lines, levels = [], height = 280, valuePrefix = "$",
}: { lines: LineDef[]; levels?: { price: number; color: string; title: string }[]; height?: number; valuePrefix?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const key = JSON.stringify({ lines, levels, valuePrefix }); // rebuild only when the data really changes

  useEffect(() => {
    if (!box.current) return;
    const { lines, levels, valuePrefix } = JSON.parse(key) as { lines: LineDef[]; levels: { price: number; color: string; title: string }[]; valuePrefix: string };
    const chart = createChart(box.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#8b91b8", fontSize: 11, fontFamily: "var(--font-geist-sans), system-ui", attributionLogo: true },
      grid: { vertLines: { visible: false }, horzLines: { color: "rgba(124,140,255,0.06)" } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, fixLeftEdge: true, fixRightEdge: true },
      crosshair: { vertLine: { labelBackgroundColor: "#2f4bff" }, horzLine: { labelBackgroundColor: "#2f4bff" } },
      localization: { priceFormatter: (p: number) => `${valuePrefix}${p.toLocaleString("en-US", { maximumFractionDigits: 0 })}` },
      handleScroll: false,
      handleScale: false,
    });
    lines.forEach((l, i) => {
      const s = l.area
        ? chart.addSeries(AreaSeries, { lineColor: l.color, topColor: l.color + "55", bottomColor: l.color + "00", lineWidth: 2, priceLineVisible: false })
        : chart.addSeries(LineSeries, { color: l.color, lineWidth: 2, priceLineVisible: false, lastValueVisible: i === 0 });
      // keep at least a ±1% window so a few dollars of movement doesn't look like a crash
      s.applyOptions({
        autoscaleInfoProvider: (orig: () => { priceRange: { minValue: number; maxValue: number } | null } | null) => {
          const r = orig();
          if (!r?.priceRange) return r;
          const lv = levels.map((x) => x.price);
          const min = Math.min(r.priceRange.minValue, ...lv), max = Math.max(r.priceRange.maxValue, ...lv);
          const mid = (min + max) / 2, half = Math.max((max - min) / 2, Math.abs(mid) * 0.01);
          return { ...r, priceRange: { minValue: mid - half, maxValue: mid + half } };
        },
      });
      s.setData(l.data.map((d) => ({ time: d.time as Time, value: d.value })));
      if (i === 0) levels.forEach((lv) => s.createPriceLine({ price: lv.price, color: lv.color, lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: lv.title }));
    });
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [key]);

  return <div ref={box} style={{ height }} className="w-full" />;
}
