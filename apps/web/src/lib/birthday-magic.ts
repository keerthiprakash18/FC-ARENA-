import { todayForBirthDate } from "./date-of-birth.ts";

/**
 * Birthday is a private account property. Only the signed-in owner's UI
 * should evaluate it. The existing account locale uses the India calendar.
 * A 29 February birthday is observed on 28 February in non-leap years.
 */
export function birthdayDateForToday(dateOfBirth: string | null | undefined, now = new Date()): string | null {
  if (!dateOfBirth || !/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(dateOfBirth)) return null;
  const birth = dateOfBirth.slice(0, 10);
  const [year, month, day] = birth.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() + 1 !== month || parsed.getUTCDate() !== day) return null;
  const today = todayForBirthDate(now);
  const [currentYear, todayMonth, todayDay] = today.split("-").map(Number);
  const isLeap = new Date(Date.UTC(currentYear, 1, 29)).getUTCMonth() === 1;
  const effectiveDay = month === 2 && day === 29 && !isLeap ? 28 : day;
  return month === todayMonth && effectiveDay === todayDay ? today : null;
}

export function birthdaySeenKey(userId: string, date: string): string {
  // The account ID and calendar day isolate users who share a browser.
  return "fc-arena:birthday-v6:seen:" + userId + ":" + date;
}
