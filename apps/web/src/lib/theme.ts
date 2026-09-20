export type ThemePreference =
  | 'LUXURY_GOLD'
  | 'CLASSIC_BLUE';

export type ThemeDataAttribute =
  | 'luxury-gold'
  | 'classic-blue';

export const DEFAULT_THEME_PREFERENCE:
  ThemePreference =
    'CLASSIC_BLUE';

export const THEME_STORAGE_KEY =
  'fc-arena-theme-preference';

export const THEME_OPTIONS = [
  {
    preference:
      'LUXURY_GOLD' as const,
    dataTheme:
      'luxury-gold' as const,
    name:
      'Luxury Gold',
    palette:
      'Cream • Navy • Gold',
    description:
      'Premium football club style',
  },
  {
    preference:
      'CLASSIC_BLUE' as const,
    dataTheme:
      'classic-blue' as const,
    name:
      'Classic Blue',
    palette:
      'White • Royal Blue • Navy',
    description:
      'Clean modern sports style',
  },
] as const;

export function isThemePreference(
  value:
    string | null | undefined,
): value is ThemePreference {
  return (
    value ===
      'LUXURY_GOLD' ||
    value ===
      'CLASSIC_BLUE'
  );
}

export function preferenceToDataTheme(
  preference:
    ThemePreference,
): ThemeDataAttribute {
  return preference ===
    'LUXURY_GOLD'
    ? 'luxury-gold'
    : 'classic-blue';
}

export function applyThemePreference(
  preference:
    ThemePreference,
  persistCache =
    true,
) {
  if (
    typeof document !==
    'undefined'
  ) {
    document.documentElement
      .dataset
      .theme =
      preferenceToDataTheme(
        preference,
      );
  }

  if (
    persistCache &&
    typeof window !==
      'undefined'
  ) {
    window.localStorage.setItem(
      THEME_STORAGE_KEY,
      preference,
    );
  }
}

export function readCachedThemePreference():
  ThemePreference {
  if (
    typeof window ===
    'undefined'
  ) {
    return DEFAULT_THEME_PREFERENCE;
  }

  const cached =
    window.localStorage.getItem(
      THEME_STORAGE_KEY,
    );

  return isThemePreference(
    cached,
  )
    ? cached
    : DEFAULT_THEME_PREFERENCE;
}

export function clearThemeCache() {
  if (
    typeof window !==
    'undefined'
  ) {
    window.localStorage.removeItem(
      THEME_STORAGE_KEY,
    );
  }

  applyThemePreference(
    DEFAULT_THEME_PREFERENCE,
    false,
  );
}
