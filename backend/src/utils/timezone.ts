// Calendar dates are handled as Date objects at UTC midnight ("2026-07-06" → 2026-07-06T00:00:00Z);
// localMidnight turns one into the instant that day starts in a given IANA time zone.

export const isValidTimeZone = (timeZone: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
};

// Parses YYYY-MM-DD; null when it isn't a real date (e.g. 2026-02-30)
export const parseCalendarDate = (value: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return !isNaN(date.getTime()) && date.toISOString().startsWith(value) ? date : null;
};

export const formatCalendarDate = (date: Date): string => date.toISOString().slice(0, 10);

// Offset of the time zone from UTC, in ms, at the given instant
const offsetAt = (instant: number, timeZone: string): number => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const wallClock = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return wallClock - Math.floor(instant / 1000) * 1000;
};

export const localMidnight = (calendarDate: Date, timeZone: string): Date => {
  const wallClock = calendarDate.getTime();
  // The second pass corrects for a DST change between the guess and the real instant
  const guess = wallClock - offsetAt(wallClock, timeZone);
  return new Date(wallClock - offsetAt(guess, timeZone));
};
