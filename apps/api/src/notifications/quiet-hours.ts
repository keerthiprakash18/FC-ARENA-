export interface QuietHours {
  enabled: boolean;
  startHour: number;
  endHour: number;
}

export const DEFAULT_QUIET_HOURS: QuietHours = {
  enabled: false,
  startHour: 22,
  endHour: 7,
};

export function normalizeQuietHours(raw: unknown): QuietHours {
  const input =
    raw !== null && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const hour = (value: unknown, fallback: number): number =>
    typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 23
      ? value
      : fallback;
  return {
    enabled: typeof input.enabled === 'boolean' ? input.enabled : DEFAULT_QUIET_HOURS.enabled,
    startHour: hour(input.startHour, DEFAULT_QUIET_HOURS.startHour),
    endHour: hour(input.endHour, DEFAULT_QUIET_HOURS.endHour),
  };
}

/**
 * Quiet hours are India Standard Time, without DST. The end hour is exclusive.
 * When start === end the window is disabled, never 24-hour suppression.
 * This only holds non-urgent PHONE PUSH; user inbox items remain visible.
 */
export function isQuietHoursActive(raw: unknown, now = new Date()): boolean {
  const settings = normalizeQuietHours(raw);
  if (!settings.enabled || settings.startHour === settings.endHour || !Number.isFinite(now.getTime())) {
    return false;
  }
  const istHour = new Date(now.getTime() + 330 * 60_000).getUTCHours();
  return settings.startHour < settings.endHour
    ? istHour >= settings.startHour && istHour < settings.endHour
    : istHour >= settings.startHour || istHour < settings.endHour;
}
