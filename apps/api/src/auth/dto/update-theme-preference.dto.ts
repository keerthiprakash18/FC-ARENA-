import {
  IsIn,
} from 'class-validator';

export const THEME_PREFERENCES = [
  'LUXURY_GOLD',
  'CLASSIC_BLUE',
] as const;

export type ThemePreferenceValue =
  (typeof THEME_PREFERENCES)[number];

export class UpdateThemePreferenceDto {
  @IsIn(THEME_PREFERENCES)
  themePreference!: ThemePreferenceValue;
}
