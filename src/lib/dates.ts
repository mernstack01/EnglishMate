// Calendar keys are civil dates, never parsed in the machine/browser timezone.
export function dateKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}
export function isDateKey(key: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(key) &&
    key >= "1970-01-01" &&
    key <= "2100-12-31" &&
    !Number.isNaN(Date.parse(`${key}T00:00:00Z`)) &&
    new Date(`${key}T00:00:00Z`).toISOString().slice(0, 10) === key
  );
}
export function addDays(key: string, days: number) {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
// Find the first instant in a civil day. Unlike adding 24h to local midnight,
// this also supports DST-short/long days and midnight timezone transitions.
export function startOfDay(key: string, timeZone: string) {
  const utc = Date.parse(`${key}T00:00:00Z`);
  let low = utc - 36 * 3600_000,
    high = utc + 36 * 3600_000;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (dateKey(new Date(mid), timeZone) < key) low = mid + 1;
    else high = mid;
  }
  return new Date(low);
}
export function dayRange(key: string, timeZone: string) {
  return {
    $gte: startOfDay(key, timeZone),
    $lt: startOfDay(addDays(key, 1), timeZone),
  };
}
export function monthKeys(month: string) {
  const first = `${month}-01`;
  const next = new Date(`${first}T12:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const nextKey = next.toISOString().slice(0, 10);
  return {
    first,
    next: nextKey,
    days: new Date(`${addDays(nextKey, -1)}T12:00:00Z`).getUTCDate(),
    offset: (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7,
  };
}
export function adjacentMonth(month: string, step: number) {
  const date = new Date(`${month}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + step);
  return date.toISOString().slice(0, 7);
}
export function longDate(key: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${key}T12:00:00Z`));
}
export function dayLabel(key: string, today: string) {
  return key === today
    ? "Today"
    : key === addDays(today, -1)
      ? "Yesterday"
      : longDate(key);
}
