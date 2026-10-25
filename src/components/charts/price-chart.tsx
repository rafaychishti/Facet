"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart, ColorType, CrosshairMode, LineStyle,
  CandlestickSeries, BarSeries, LineSeries, AreaSeries, HistogramSeries,
  type IChartApi, type ISeriesApi, type SeriesType, type UTCTimestamp, type MouseEventParams, type Time,
} from "lightweight-charts";
import { MousePointer2, Minus, TrendingUp, Ruler, Trash2, CandlestickChart, BarChart2, LineChart as LineIcon, AreaChart, SlidersHorizontal, Maximize2 } from "lucide-react";
import type { Timeframe, Candle } from "@/lib/market/types";
import { useCandles } from "@/lib/hooks";
import { sma, ema, bollinger, vwap, rsi, macd } from "@/lib/indicators";
import { cn, num, compact } from "@/lib/format";

type ChartType = "candles" | "bars" | "line" | "area";
type Indicator = "vol" | "sma20" | "ema50" | "bb" | "vwap" | "rsi" | "macd";
type Tool = "cursor" | "trend" | "hline" | "fib";
type P = { time: number; price: number };
type Drawing = { id: number; kind: "trend" | "fib"; a: P; b: P } | { id: number; kind: "hline"; price: number };

const TFS: Timeframe[] = ["1m", "5m", "15m", "1H", "4H", "1D", "1W"];
const IND_LABEL: Record<Indicator, string> = { vol: "Volume", sma20: "SMA 20", ema50: "EMA 50", bb: "Bollinger 20,2", vwap: "VWAP", rsi: "RSI 14", macd: "MACD 12,26,9" };
const FIB = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

const C = { up: "#2fe0a0", down: "#ff4d6d", blue: "#4d6bff", glow: "#6f8bff", violet: "#8b6cff", warn: "#ffb547", text: "#8b91b8", grid: "rgba(124,140,255,0.06)", border: "rgba(124,140,255,0.14)" };

const ts = (t: number) => t as UTCTimestamp;

export type PriceLine = { price: number; color: string; title: string };
const EMPTY: Candle[] = [];

export function PriceChart({
  symbol, height = 520, defaultTf = "1D", toolbar = true, defaultIndicators = ["vol", "sma20"] as Indicator[], className, priceLines = [],
}: { symbol: string; height?: number; defaultTf?: Timeframe; toolbar?: boolean; defaultIndicators?: Indicator[]; className?: string; priceLines?: PriceLine[] }) {
  const box = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mainRef = useRef<ISeriesApi<SeriesType> | null>(null);
  const [tf, setTf] = useState<Timeframe>(defaultTf);
  const [type, setType] = useState<ChartType>("candles");
  const [inds, setInds] = useState<Indicator[]>(defaultIndicators);
  const [tool, setTool] = useState<Tool>("cursor");
  const [drawState, setDrawState] = useState<{ symbol: string; items: Drawing[] }>({ symbol, items: [] });
  const drawings = useMemo(() => (drawState.symbol === symbol ? drawState.items : []), [drawState, symbol]);
  const setDrawings = (fn: Drawing[] | ((d: Drawing[]) => Drawing[])) =>
    setDrawState((prev) => {
      const cur = prev.symbol === symbol ? prev.items : [];
      return { symbol, items: typeof fn === "function" ? fn(cur) : fn };
    });
  const [pending, setPending] = useState<P | null>(null);
  const [legend, setLegend] = useState<Candle | null>(null);
  const [indOpen, setIndOpen] = useState(false);

  const rangeRef = useRef<{ key: string; range: { from: number; to: number } } | null>(null);
  const toolRef = useRef(tool);
  const pendingRef = useRef(pending);
  useEffect(() => {
    toolRef.current = tool;
    pendingRef.current = pending;
  }, [tool, pending]);

  const { data: res, isLoading, error } = useCandles(symbol, tf);
  const data = useMemo(() => res?.candles ?? EMPTY, [res]);
  const last = data[data.length - 1];
  const shown = legend ?? last;
  const linesKey = JSON.stringify(priceLines);


  useEffect(() => {
    if (!box.current || data.length === 0) return;
    const lines = JSON.parse(linesKey) as PriceLine[];
    const chart = createChart(box.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: C.text,
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        fontSize: 11,
        attributionLogo: true, // required by the Lightweight Charts licence
        panes: { separatorColor: C.border, separatorHoverColor: "rgba(77,107,255,0.3)" },
      },
      grid: { vertLines: { color: C.grid }, horzLines: { color: C.grid } },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "rgba(111,139,255,0.5)", labelBackgroundColor: C.blue },
        horzLine: { color: "rgba(111,139,255,0.5)", labelBackgroundColor: C.blue },
      },
      rightPriceScale: { borderColor: C.border },
      timeScale: { borderColor: C.border, timeVisible: !["1D", "1W"].includes(tf), rightOffset: 6 },
    });
    chartRef.current = chart;

    // Main series
    let main: ISeriesApi<SeriesType>;
    if (type === "candles") {
      main = chart.addSeries(CandlestickSeries, { upColor: C.up, downColor: C.down, borderVisible: false, wickUpColor: C.up, wickDownColor: C.down });
      main.setData(data.map((d) => ({ ...d, time: ts(d.time) })));
    } else if (type === "bars") {
      main = chart.addSeries(BarSeries, { upColor: C.up, downColor: C.down, thinBars: false });
      main.setData(data.map((d) => ({ ...d, time: ts(d.time) })));
    } else if (type === "line") {
      main = chart.addSeries(LineSeries, { color: C.glow, lineWidth: 2 });
      main.setData(data.map((d) => ({ time: ts(d.time), value: d.close })));
    } else {
      main = chart.addSeries(AreaSeries, { lineColor: C.glow, topColor: "rgba(77,107,255,0.35)", bottomColor: "rgba(77,107,255,0)", lineWidth: 2 });
      main.setData(data.map((d) => ({ time: ts(d.time), value: d.close })));
    }
    mainRef.current = main;

    const overlay = (pts: { time: number; value: number }[], color: string, width: 1 | 2 = 1, style = LineStyle.Solid) => {
      const s = chart.addSeries(LineSeries, { color, lineWidth: width, lineStyle: style, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
      s.setData(pts.map((p) => ({ time: ts(p.time), value: p.value })));
      return s;
    };

    if (inds.includes("vol")) {
      const v = chart.addSeries(HistogramSeries, { priceScaleId: "vol", priceFormat: { type: "volume" }, lastValueVisible: false, priceLineVisible: false });
      v.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      v.setData(data.map((d) => ({ time: ts(d.time), value: d.volume, color: d.close >= d.open ? "rgba(47,224,160,0.35)" : "rgba(255,77,109,0.35)" })));
    }
    if (inds.includes("sma20")) overlay(sma(data, 20), C.warn);
    if (inds.includes("ema50")) overlay(ema(data, 50), C.violet);
    if (inds.includes("vwap")) overlay(vwap(data), "#38bdf8", 1, LineStyle.Dashed);
    if (inds.includes("bb")) {
      const b = bollinger(data);
      overlay(b.upper, "rgba(111,139,255,0.7)");
      overlay(b.mid, "rgba(111,139,255,0.35)", 1, LineStyle.Dotted);
      overlay(b.lower, "rgba(111,139,255,0.7)");
    }
    let pane = 1;
    if (inds.includes("rsi")) {
      const r = chart.addSeries(LineSeries, { color: C.violet, lineWidth: 1, priceLineVisible: false }, pane);
      r.setData(rsi(data).map((p) => ({ time: ts(p.time), value: p.value })));
      r.createPriceLine({ price: 70, color: "rgba(255,77,109,0.5)", lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: false });
      r.createPriceLine({ price: 30, color: "rgba(47,224,160,0.5)", lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: false });
      pane++;
    }
    if (inds.includes("macd")) {
      const m = macd(data);
      const h = chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false }, pane);
      h.setData(m.hist.map((p) => ({ time: ts(p.time), value: p.value, color: p.value >= 0 ? "rgba(47,224,160,0.5)" : "rgba(255,77,109,0.5)" })));
      const ml = chart.addSeries(LineSeries, { color: C.glow, lineWidth: 1, priceLineVisible: false }, pane);
      ml.setData(m.macd.map((p) => ({ time: ts(p.time), value: p.value })));
      const sl = chart.addSeries(LineSeries, { color: C.warn, lineWidth: 1, priceLineVisible: false, lastValueVisible: false }, pane);
      sl.setData(m.signal.map((p) => ({ time: ts(p.time), value: p.value })));
    }
    chart.panes().forEach((p, i) => i > 0 && p.setStretchFactor(0.28));

    // Position / order levels from the account
    for (const l of lines) main.createPriceLine({ price: l.price, color: l.color, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: l.title });

    // Drawings
    for (const d of drawings) {
      if (d.kind === "hline") {
        main.createPriceLine({ price: d.price, color: C.glow, lineWidth: 1, lineStyle: LineStyle.Solid, axisLabelVisible: true, title: "" });
      } else if (d.kind === "trend") {
        const [a, b] = [d.a, d.b].sort((x, y) => x.time - y.time);
        if (a.time === b.time) continue;
        const s = chart.addSeries(LineSeries, { color: "#e9ecff", lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, autoscaleInfoProvider: () => null });
        s.setData([{ time: ts(a.time), value: a.price }, { time: ts(b.time), value: b.price }]);
      } else {
        const hi = Math.max(d.a.price, d.b.price), lo = Math.min(d.a.price, d.b.price);
        FIB.forEach((lvl) => {
          main.createPriceLine({ price: hi - (hi - lo) * lvl, color: lvl === 0.618 ? C.warn : "rgba(139,108,255,0.7)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: `${lvl}` });
        });
      }
    }

    const onMove = (p: MouseEventParams<Time>) => {
      const bar = p.seriesData.get(main) as { open?: number; value?: number } | undefined;
      if (!bar || p.time === undefined) return setLegend(null);
      const found = data.find((d) => d.time === (p.time as number));
      setLegend(found ?? null);
    };
    const onClick = (p: MouseEventParams<Time>) => {
      const t = toolRef.current;
      if (t === "cursor" || !p.point || p.time === undefined) return;
      const price = main.coordinateToPrice(p.point.y);
      if (price === null) return;
      const pt = { time: p.time as number, price };
      if (t === "hline") {
        setDrawings((ds) => [...ds, { id: Date.now(), kind: "hline", price }]);
        setTool("cursor");
        return;
      }
      const first = pendingRef.current;
      if (!first) return setPending(pt);
      setDrawings((ds) => [...ds, { id: Date.now(), kind: t, a: first, b: pt }]);
      setPending(null);
      setTool("cursor");
    };
    chart.subscribeCrosshairMove(onMove);
    chart.subscribeClick(onClick);
    // Keep the user's zoom/scroll when the chart is rebuilt (new indicator, drawing, chart type)
    const key = `${symbol}-${tf}`;
    const saved = rangeRef.current;
    chart.timeScale().setVisibleLogicalRange(saved && saved.key === key ? saved.range : { from: data.length - 140, to: data.length + 4 });

    return () => {
      const r = chart.timeScale().getVisibleLogicalRange();
      if (r) rangeRef.current = { key, range: { from: r.from, to: r.to } };
      chart.unsubscribeCrosshairMove(onMove);
      chart.unsubscribeClick(onClick);
      chart.remove();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, type, inds, drawings, tf, linesKey]);

  const toggleInd = (i: Indicator) => setInds((xs) => (xs.includes(i) ? xs.filter((x) => x !== i) : [...xs, i]));
  const up = shown ? shown.close >= shown.open : true;

  return (
    <div className={cn("flex flex-col", className)}>
      {toolbar && (
        <div className="flex flex-wrap items-center gap-1 border-b border-line px-3 py-2">
          <div className="flex rounded-lg bg-white/[0.03] p-0.5">
            {TFS.map((t) => (
              <button key={t} onClick={() => setTf(t)} className={cn("rounded-md px-2.5 py-1 text-xs transition", tf === t ? "bg-blue text-white" : "text-muted hover:text-text")}>
                {t}
              </button>
            ))}
          </div>
          <span className="mx-1 h-5 w-px bg-line" />
          {([
            ["candles", <CandlestickChart key="c" size={15} />],
            ["bars", <BarChart2 key="b" size={15} />],
            ["line", <LineIcon key="l" size={15} />],
            ["area", <AreaChart key="a" size={15} />],
          ] as [ChartType, React.ReactNode][]).map(([k, icon]) => (
            <button key={k} title={k} onClick={() => setType(k)} className={cn("grid size-7 place-items-center rounded-md transition", type === k ? "bg-white/[0.08] text-text" : "text-muted hover:text-text")}>
              {icon}
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-line" />
          <div className="relative">
            <button onClick={() => setIndOpen((o) => !o)} className="flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-muted hover:bg-white/[0.05] hover:text-text">
              <SlidersHorizontal size={14} /> Indicators <span className="rounded bg-blue/20 px-1 text-[10px] text-blue-glow">{inds.length}</span>
            </button>
            {indOpen && (
              <div className="glass absolute top-9 left-0 z-30 w-52 p-1.5">
                {(Object.keys(IND_LABEL) as Indicator[]).map((i) => (
                  <label key={i} className="flex cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-xs hover:bg-white/[0.05]">
                    {IND_LABEL[i]}
                    <input type="checkbox" checked={inds.includes(i)} onChange={() => toggleInd(i)} className="accent-[#4d6bff]" />
                  </label>
                ))}
              </div>
            )}
          </div>
          <span className="mx-1 h-5 w-px bg-line" />
          {([
            ["cursor", <MousePointer2 key="c" size={14} />, "Cursor"],
            ["trend", <TrendingUp key="t" size={14} />, "Trend line (2 clicks)"],
            ["hline", <Minus key="h" size={14} />, "Horizontal line"],
            ["fib", <Ruler key="f" size={14} />, "Fib retracement (2 clicks)"],
          ] as [Tool, React.ReactNode, string][]).map(([k, icon, label]) => (
            <button key={k} title={label} onClick={() => { setTool(k); setPending(null); }} className={cn("grid size-7 place-items-center rounded-md transition", tool === k ? "bg-blue/25 text-blue-glow" : "text-muted hover:text-text")}>
              {icon}
            </button>
          ))}
          <button title="Clear drawings" onClick={() => setDrawings([])} className="grid size-7 place-items-center rounded-md text-muted hover:text-down">
            <Trash2 size={14} />
          </button>
          <button title="Layouts (multi-chart) arrive with the live data step" className="ml-auto grid size-7 place-items-center rounded-md text-muted hover:text-text">
            <Maximize2 size={14} />
          </button>
        </div>
      )}
      <div className="relative" style={{ height }}>
        <div className="pointer-events-none absolute top-2 left-3 z-10 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
          <span className="font-medium text-text">{symbol} · {tf}</span>
          {shown && (
            <>
              <span className="num text-muted">O <b className={up ? "text-up" : "text-down"}>{num(shown.open)}</b></span>
              <span className="num text-muted">H <b className={up ? "text-up" : "text-down"}>{num(shown.high)}</b></span>
              <span className="num text-muted">L <b className={up ? "text-up" : "text-down"}>{num(shown.low)}</b></span>
              <span className="num text-muted">C <b className={up ? "text-up" : "text-down"}>{num(shown.close)}</b></span>
              <span className="num text-muted">Vol <b className="text-text">{compact(shown.volume)}</b></span>
            </>
          )}
          {res?.source === "demo" && <span className="rounded bg-warn/15 px-1.5 text-warn">Demo data</span>}
          {tool !== "cursor" && <span className="rounded bg-blue/20 px-1.5 text-blue-glow">{pending ? "Click second point" : tool === "hline" ? "Click a price level" : "Click first point"}</span>}
        </div>
        <div ref={box} className={cn("absolute inset-0", tool !== "cursor" && "cursor-crosshair")} />
        {data.length === 0 && (
          <div className="absolute inset-0 grid place-items-center text-sm text-muted">
            {error ? `Couldn't load ${symbol} chart data.` : isLoading ? <span className="h-1 w-40 animate-pulse rounded-full bg-blue/40" /> : `No ${tf} data for ${symbol}.`}
          </div>
        )}
      </div>
    </div>
  );
}
