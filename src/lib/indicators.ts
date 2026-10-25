import type { Candle } from "./market/types";

export type Pt = { time: number; value: number };

export function sma(c: Candle[], len: number): Pt[] {
  const out: Pt[] = [];
  let sum = 0;
  for (let i = 0; i < c.length; i++) {
    sum += c[i].close;
    if (i >= len) sum -= c[i - len].close;
    if (i >= len - 1) out.push({ time: c[i].time, value: sum / len });
  }
  return out;
}

function emaValues(values: number[], len: number): number[] {
  const k = 2 / (len + 1);
  const out: number[] = [];
  values.forEach((v, i) => out.push(i === 0 ? v : v * k + out[i - 1] * (1 - k)));
  return out;
}

export function ema(c: Candle[], len: number): Pt[] {
  const e = emaValues(c.map((x) => x.close), len);
  return c.map((x, i) => ({ time: x.time, value: e[i] })).slice(len);
}

export function bollinger(c: Candle[], len = 20, mult = 2) {
  const upper: Pt[] = [], lower: Pt[] = [], mid: Pt[] = [];
  for (let i = len - 1; i < c.length; i++) {
    const w = c.slice(i - len + 1, i + 1).map((x) => x.close);
    const m = w.reduce((a, b) => a + b, 0) / len;
    const sd = Math.sqrt(w.reduce((a, b) => a + (b - m) ** 2, 0) / len);
    mid.push({ time: c[i].time, value: m });
    upper.push({ time: c[i].time, value: m + mult * sd });
    lower.push({ time: c[i].time, value: m - mult * sd });
  }
  return { upper, mid, lower };
}

export function vwap(c: Candle[]): Pt[] {
  let pv = 0, v = 0;
  return c.map((x) => {
    const tp = (x.high + x.low + x.close) / 3;
    pv += tp * x.volume;
    v += x.volume;
    return { time: x.time, value: pv / v };
  });
}

export function rsi(c: Candle[], len = 14): Pt[] {
  const out: Pt[] = [];
  let gain = 0, loss = 0;
  for (let i = 1; i < c.length; i++) {
    const d = c[i].close - c[i - 1].close;
    const g = Math.max(d, 0), l = Math.max(-d, 0);
    if (i <= len) {
      gain += g / len;
      loss += l / len;
      if (i === len) out.push({ time: c[i].time, value: 100 - 100 / (1 + gain / (loss || 1e-9)) });
    } else {
      gain = (gain * (len - 1) + g) / len;
      loss = (loss * (len - 1) + l) / len;
      out.push({ time: c[i].time, value: 100 - 100 / (1 + gain / (loss || 1e-9)) });
    }
  }
  return out;
}

export function macd(c: Candle[], fast = 12, slow = 26, signal = 9) {
  const closes = c.map((x) => x.close);
  const f = emaValues(closes, fast), s = emaValues(closes, slow);
  const line = closes.map((_, i) => f[i] - s[i]);
  const sig = emaValues(line, signal);
  const start = slow;
  return {
    macd: c.slice(start).map((x, i) => ({ time: x.time, value: line[i + start] })),
    signal: c.slice(start).map((x, i) => ({ time: x.time, value: sig[i + start] })),
    hist: c.slice(start).map((x, i) => ({ time: x.time, value: line[i + start] - sig[i + start] })),
  };
}
