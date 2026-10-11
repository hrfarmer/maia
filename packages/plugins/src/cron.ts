import { CronExpressionParser } from "cron-parser";

export function isValidCronExpression(expression: string): boolean {
  const trimmed = expression.trim();
  if (!trimmed) {
    return false;
  }
  const fields = trimmed.split(/\s+/);
  if (fields.length !== 5) {
    return false;
  }
  try {
    CronExpressionParser.parse(trimmed, { tz: "UTC" });
    return true;
  } catch {
    return false;
  }
}

export function utcMinuteStart(date: Date): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      date.getUTCHours(),
      date.getUTCMinutes(),
      0,
      0,
    ),
  );
}

export function cronMatchesUtcMinute(expression: string, at: Date): boolean {
  if (!isValidCronExpression(expression)) {
    return false;
  }
  const minuteStart = utcMinuteStart(at);
  const probe = new Date(minuteStart.getTime() - 1_000);
  try {
    const interval = CronExpressionParser.parse(expression.trim(), {
      tz: "UTC",
      currentDate: probe,
    });
    const next = interval.next().toDate();
    return next.getTime() === minuteStart.getTime();
  } catch {
    return false;
  }
}
