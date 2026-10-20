const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Accepts a Unix timestamp in seconds or milliseconds and returns a Date.
 * Values below 1e12 are treated as seconds (1e12 ms is in the year 2001).
 */
export function timestampToDate(timestamp: number): Date {
  return new Date(timestamp < 1e12 ? timestamp * 1000 : timestamp);
}

/** Offset of `timeZone` from UTC at the given instant, in ms (e.g. +19800000 for IST). */
function getTimezoneOffsetMs(instantMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instantMs));

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const wallClockAsUTC = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));

  return wallClockAsUTC - Math.floor(instantMs / 1000) * 1000;
}

/** Converts a local midnight (expressed as a UTC wall-clock ms value) to the real instant in `timeZone`. */
function localMidnightToInstant(localMidnightMs: number, timeZone: string): Date {
  const offset = getTimezoneOffsetMs(localMidnightMs, timeZone);
  return new Date(localMidnightMs - offset);
}

/**
 * Returns the [start, end) range of the calendar day that `date` falls on in `timeZone`.
 * DST-safe: start and end are computed independently.
 */
export function getDayRange(date: Date, timeZone: string): { start: Date; end: Date } {
  const local = new Date(date.getTime() + getTimezoneOffsetMs(date.getTime(), timeZone));
  const localMidnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());

  return {
    start: localMidnightToInstant(localMidnight, timeZone),
    end: localMidnightToInstant(localMidnight + DAY_MS, timeZone),
  };
}
