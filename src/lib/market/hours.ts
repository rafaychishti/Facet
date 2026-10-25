/** US equity market calendar (regular session, NYSE/Nasdaq). */

const HOLIDAYS = new Set([
  // 2026
  "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25", "2026-06-19",
  "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
  // 2027
  "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31", "2027-06-18",
  "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-24",
]);

/** Wall-clock parts in New York for a given instant. */
export function nyParts(d = new Date()) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short",
  });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return {
    date: `${p.year}-${p.month}-${p.day}`, // trading day key, e.g. 2026-10-23
    minutes: Number(p.hour) * 60 + Number(p.minute),
    weekday: p.weekday as string,
  };
}

export const isTradingDay = (d = new Date()) => {
  const { date, weekday } = nyParts(d);
  return weekday !== "Sat" && weekday !== "Sun" && !HOLIDAYS.has(date);
};

export const OPEN_MIN = 9 * 60 + 30;
export const CLOSE_MIN = 16 * 60;

export function isMarketOpen(d = new Date()) {
  if (!isTradingDay(d)) return false;
  const { minutes } = nyParts(d);
  return minutes >= OPEN_MIN && minutes < CLOSE_MIN;
}

/** True once the 4:00 PM ET close has passed on a trading day. */
export const isAfterClose = (d = new Date()) => isTradingDay(d) && nyParts(d).minutes >= CLOSE_MIN;

export const tradingDayKey = (d = new Date()) => nyParts(d).date;

export function marketStatus(d = new Date()) {
  const open = isMarketOpen(d);
  const { minutes } = nyParts(d);
  let label = "Market closed";
  if (open) label = "Market open";
  else if (isTradingDay(d) && minutes < OPEN_MIN && minutes >= 4 * 60) label = "Pre-market";
  else if (isTradingDay(d) && minutes >= CLOSE_MIN && minutes < 20 * 60) label = "After hours";
  return { open, label };
}
