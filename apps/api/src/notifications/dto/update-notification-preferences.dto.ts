import { IsBoolean, IsOptional } from 'class-validator';

export const NOTIFICATION_PREFERENCE_KEYS = [
  'matchReminders',
  'leagueActivity',
  'tournamentActivity',
  'resultUpdates',
  'disputeUpdates',
  'achievements',
  'fairPlayUpdates',
] as const;

export type NotificationPreferenceKey = (typeof NOTIFICATION_PREFERENCE_KEYS)[number];

export type NotificationPreferences = Record<NotificationPreferenceKey, boolean>;

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  matchReminders: true,
  leagueActivity: true,
  tournamentActivity: true,
  resultUpdates: true,
  disputeUpdates: true,
  achievements: true,
  fairPlayUpdates: true,
};

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  matchReminders?: boolean;

  @IsOptional()
  @IsBoolean()
  leagueActivity?: boolean;

  @IsOptional()
  @IsBoolean()
  tournamentActivity?: boolean;

  @IsOptional()
  @IsBoolean()
  resultUpdates?: boolean;

  @IsOptional()
  @IsBoolean()
  disputeUpdates?: boolean;

  @IsOptional()
  @IsBoolean()
  achievements?: boolean;

  @IsOptional()
  @IsBoolean()
  fairPlayUpdates?: boolean;
}
