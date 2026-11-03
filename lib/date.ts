const easternCalendar = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
});

export function getBusinessDate(date = new Date()): string {
  const parts = easternCalendar.formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(part => part.type === type)!.value);
  // Subtract a calendar day, rather than elapsed hours, across daylight saving changes.
  const calendarDate = new Date(Date.UTC(value("year"), value("month") - 1, value("day")));
  if (value("hour") < 4) calendarDate.setUTCDate(calendarDate.getUTCDate() - 1);
  return calendarDate.toISOString().slice(0, 10);
}
