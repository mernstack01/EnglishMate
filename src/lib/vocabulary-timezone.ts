import "server-only";
// Future user.timeZone preference should be resolved here, before the app default.
export function vocabularyTimezone() {
  const timezone = process.env.APP_TIMEZONE || "Asia/Tashkent";
  new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
  return timezone;
}
