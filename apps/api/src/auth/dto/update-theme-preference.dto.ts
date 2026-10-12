import {
  IsIn,
} from 'class-validator';

export const THEME_PREFERENCES = [
  'LUXURY_GOLD',
  'CLASSIC_BLUE',
  'CITY_SKY',
  'LONDON_RED',
  'MERSEY_RED',
  'MADRID_ROYAL',
  'CATALAN_NIGHTS',
  'MUNICH_RED',
  'PARIS_NIGHT',
  'MILAN_BLUE',
  'MILAN_RED',
  'TURIN_MONO',
] as const;

export type ThemePreferenceValue =
  (typeof THEME_PREFERENCES)[number];

export class UpdateThemePreferenceDto {
  @IsIn(THEME_PREFERENCES)
  themePreference!: ThemePreferenceValue;
}
