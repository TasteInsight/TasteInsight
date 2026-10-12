const campusOffsetMs = 8 * 60 * 60 * 1000;

export function campusWeekKey(now: Date): string {
  const localDate = new Date(now.getTime() + campusOffsetMs);
  localDate.setUTCDate(
    localDate.getUTCDate() - ((localDate.getUTCDay() + 6) % 7),
  );
  return localDate.toISOString().slice(0, 10);
}
