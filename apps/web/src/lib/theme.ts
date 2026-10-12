export const THEME_PREFERENCES = [
  "LUXURY_GOLD",
  "CLASSIC_BLUE",
  "CITY_SKY",
  "LONDON_RED",
  "MERSEY_RED",
  "MADRID_ROYAL",
  "CATALAN_NIGHTS",
  "MUNICH_RED",
  "PARIS_NIGHT",
  "MILAN_BLUE",
  "MILAN_RED",
  "TURIN_MONO",
] as const;

export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export type ThemeDataAttribute =
  | "luxury-gold"
  | "classic-blue"
  | "city-sky"
  | "london-red"
  | "mersey-red"
  | "madrid-royal"
  | "catalan-nights"
  | "munich-red"
  | "paris-night"
  | "milan-blue"
  | "milan-red"
  | "turin-mono";

export interface ThemeOption {
  preference: ThemePreference;
  dataTheme: ThemeDataAttribute;
  name: string;
  palette: string;
  description: string;
  inspiration: string;
  preview: {
    background: string;
    sidebar: string;
    accent: string;
    surface: string;
  };
}

export const DEFAULT_THEME_PREFERENCE: ThemePreference = "LUXURY_GOLD";

export const THEME_STORAGE_KEY = "fc-arena-theme-preference";

export const THEME_OPTIONS: readonly ThemeOption[] = [
  {
    preference: "LUXURY_GOLD",
    dataTheme: "luxury-gold",
    name: "Luxury Gold",
    palette: "Cream • Navy • Gold",
    description: "FC ARENA's premium default football presentation.",
    inspiration: "FC ARENA Original",
    preview: { background: "#f6f4ee", sidebar: "#061e35", accent: "#d9b765", surface: "#fffefa" },
  },
  {
    preference: "CLASSIC_BLUE",
    dataTheme: "classic-blue",
    name: "Classic Blue",
    palette: "White • Royal Blue • Navy",
    description: "Clean modern sports styling with a bright blue accent.",
    inspiration: "FC ARENA Classic",
    preview: { background: "#f5f8fd", sidebar: "#ffffff", accent: "#1168d0", surface: "#ffffff" },
  },
  {
    preference: "CITY_SKY",
    dataTheme: "city-sky",
    name: "Manchester City",
    palette: "Sky Blue • Midnight Navy • White",
    description: "Sky-blue matchday skin with floodlight geometry, stadium arcs and City-style visual rhythm.",
    inspiration: "Unofficial Manchester City fan theme",
    preview: { background: "#eef8fc", sidebar: "#071d31", accent: "#63b6dc", surface: "#ffffff" },
  },
  {
    preference: "LONDON_RED",
    dataTheme: "london-red",
    name: "Arsenal",
    palette: "Red • White • Deep Navy",
    description: "Red-and-white North London skin with sharp diagonal structure and premium matchday contrast.",
    inspiration: "Unofficial Arsenal fan theme",
    preview: { background: "#fbf4f4", sidebar: "#151b2b", accent: "#d71920", surface: "#ffffff" },
  },
  {
    preference: "MERSEY_RED",
    dataTheme: "mersey-red",
    name: "Liverpool",
    palette: "Deep Red • Cream • Charcoal",
    description: "Deep red matchday skin with warm stadium glow, pinstripe motion and heritage-style depth.",
    inspiration: "Unofficial Liverpool fan theme",
    preview: { background: "#f8f2ef", sidebar: "#231317", accent: "#c8102e", surface: "#fffaf6" },
  },
  {
    preference: "MADRID_ROYAL",
    dataTheme: "madrid-royal",
    name: "Real Madrid",
    palette: "White • Royal Blue • Gold",
    description: "White, royal blue and gold skin with architectural slats and a polished European-night feel.",
    inspiration: "Unofficial Real Madrid fan theme",
    preview: { background: "#f8f8fb", sidebar: "#101b3e", accent: "#2848a9", surface: "#ffffff" },
  },
  {
    preference: "CATALAN_NIGHTS",
    dataTheme: "catalan-nights",
    name: "Barcelona",
    palette: "Midnight Blue • Burgundy • Electric Blue",
    description: "Blue-and-burgundy vertical matchday skin with a dramatic night-game presentation.",
    inspiration: "Unofficial Barcelona fan theme",
    preview: { background: "#0b1020", sidebar: "#080d18", accent: "#2f77ff", surface: "#11182a" },
  },
  {
    preference: "MUNICH_RED",
    dataTheme: "munich-red",
    name: "Bayern Munich",
    palette: "Red • White • Graphite",
    description: "Red-and-white skin with diamond geometry, high-contrast surfaces and a clean Bavarian matchday feel.",
    inspiration: "Unofficial Bayern Munich fan theme",
    preview: { background: "#faf5f5", sidebar: "#201315", accent: "#d0021b", surface: "#ffffff" },
  },
  {
    preference: "PARIS_NIGHT",
    dataTheme: "paris-night",
    name: "Paris Saint-Germain",
    palette: "Midnight Navy • Red • Ice White",
    description: "Midnight navy skin with a bold central red stripe, luminous surfaces and a Paris night-match feel.",
    inspiration: "Unofficial PSG fan theme",
    preview: { background: "#081321", sidebar: "#050d18", accent: "#e31b36", surface: "#0f1d2d" },
  },
  {
    preference: "MILAN_BLUE",
    dataTheme: "milan-blue",
    name: "Inter Milan",
    palette: "Black • Royal Blue • Steel",
    description: "Black-and-blue striped matchday skin with metallic contrast and a dramatic stadium-night atmosphere.",
    inspiration: "Unofficial Inter Milan fan theme",
    preview: { background: "#090d14", sidebar: "#05080d", accent: "#1672d4", surface: "#101722" },
  },
  {
    preference: "MILAN_RED",
    dataTheme: "milan-red",
    name: "AC Milan",
    palette: "Black • Crimson • Smoke",
    description: "Black-and-crimson striped skin with smoky surfaces and a classic Milan night-game presentation.",
    inspiration: "Unofficial AC Milan fan theme",
    preview: { background: "#0d0b0d", sidebar: "#080608", accent: "#d5192d", surface: "#171217" },
  },
  {
    preference: "TURIN_MONO",
    dataTheme: "turin-mono",
    name: "Juventus",
    palette: "Black • White • Silver",
    description: "Black-and-white striped skin with metallic detail and a sharp monochrome matchday identity.",
    inspiration: "Unofficial Juventus fan theme",
    preview: { background: "#f2f3f4", sidebar: "#101214", accent: "#34383d", surface: "#ffffff" },
  },
] as const;

const dataThemeByPreference = new Map<ThemePreference, ThemeDataAttribute>(
  THEME_OPTIONS.map((option) => [option.preference, option.dataTheme]),
);

export function isThemePreference(
  value: string | null | undefined,
): value is ThemePreference {
  return Boolean(value && (THEME_PREFERENCES as readonly string[]).includes(value));
}

export function preferenceToDataTheme(
  preference: ThemePreference,
): ThemeDataAttribute {
  return dataThemeByPreference.get(preference) ?? "luxury-gold";
}

export function applyThemePreference(
  preference: ThemePreference,
  persistCache = true,
) {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = preferenceToDataTheme(preference);
  }

  if (persistCache && typeof window !== "undefined") {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  }
}

export function readCachedThemePreference(): ThemePreference {
  if (typeof window === "undefined") {
    return DEFAULT_THEME_PREFERENCE;
  }

  const cached = window.localStorage.getItem(THEME_STORAGE_KEY);

  return isThemePreference(cached) ? cached : DEFAULT_THEME_PREFERENCE;
}

export function clearThemeCache() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(THEME_STORAGE_KEY);
  }

  applyThemePreference(DEFAULT_THEME_PREFERENCE, false);
}

export type DisplayMode = "LIGHT" | "DARK" | "SYSTEM";

export const DEFAULT_DISPLAY_MODE: DisplayMode = "LIGHT";

export const DISPLAY_MODE_STORAGE_KEY = "fc-arena-display-mode";

export function isDisplayMode(
  value: string | null | undefined,
): value is DisplayMode {
  return value === "LIGHT" || value === "DARK" || value === "SYSTEM";
}

export function applyDisplayMode(mode: DisplayMode, persistCache = true) {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.mode = (mode === "DARK" || (mode === "SYSTEM" && window.matchMedia("(prefers-color-scheme: dark)").matches)) ? "dark" : "light";
  }

  if (persistCache && typeof window !== "undefined") {
    window.localStorage.setItem(DISPLAY_MODE_STORAGE_KEY, mode);
  }
}

export function readCachedDisplayMode(): DisplayMode {
  if (typeof window === "undefined") {
    return DEFAULT_DISPLAY_MODE;
  }

  const cached = window.localStorage.getItem(DISPLAY_MODE_STORAGE_KEY);

  return isDisplayMode(cached) ? cached : DEFAULT_DISPLAY_MODE;
}
