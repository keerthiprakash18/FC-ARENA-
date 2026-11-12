'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type AppLanguage = 'en' | 'ta';

const STORAGE_KEY = 'fc-arena-ui-language';

const NAV_LABELS: Readonly<Record<string, { en: string; ta: string; shortTa: string }>> = {
  '/dashboard': { en: 'Home', ta: 'முகப்பு', shortTa: 'முகப்பு' },
  '/leagues': { en: 'League', ta: 'லீக்', shortTa: 'லீக்' },
  '/tournaments': { en: 'Tournament', ta: 'போட்டித் தொடர்', shortTa: 'கோப்பை' },
  '/elite-cup': { en: 'Elite Cup', ta: 'எலைட் கோப்பை', shortTa: 'எலைட்' },
  '/ucl-cup': { en: 'UCL Cup', ta: 'UCL கோப்பை', shortTa: 'UCL' },
  '/fixtures': { en: 'Fixtures', ta: 'போட்டிகள்', shortTa: 'போட்டிகள்' },
  '/more': { en: 'More', ta: 'மேலும்', shortTa: 'மேலும்' },
};

type AppLanguageContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  navLabel: (href: string, fallback: string, short?: boolean) => string;
};

const AppLanguageContext = createContext<AppLanguageContextValue | null>(null);

function validLanguage(value: string | null): AppLanguage {
  return value === 'ta' ? 'ta' : 'en';
}

export function AppLanguageProvider({ children }: { children: ReactNode }) {
  // Keep the initial client/server markup identical; hydrate saved locale
  // after mount to avoid a React mismatch in Next.js and Android WebView.
  const [language, setLanguageState] = useState<AppLanguage>('en');

  useEffect(() => {
    try {
      setLanguageState(validLanguage(window.localStorage.getItem(STORAGE_KEY)));
    } catch {
      setLanguageState('en');
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setLanguageState(validLanguage(event.newValue));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language === 'ta' ? 'ta' : 'en';
  }, [language]);

  const setLanguage = useCallback((next: AppLanguage) => {
    const safe = validLanguage(next);
    setLanguageState(safe);
    try {
      window.localStorage.setItem(STORAGE_KEY, safe);
    } catch {
      // Language still changes for this session when storage is unavailable.
    }
  }, []);

  const navLabel = useCallback((href: string, fallback: string, short = false) => {
    if (language !== 'ta') return fallback;
    const label = NAV_LABELS[href];
    return label ? (short ? label.shortTa : label.ta) : fallback;
  }, [language]);

  const value = useMemo(
    () => ({ language, setLanguage, navLabel }),
    [language, setLanguage, navLabel],
  );

  return (
    <AppLanguageContext.Provider value={value}>
      {children}
    </AppLanguageContext.Provider>
  );
}

export function useAppLanguage(): AppLanguageContextValue {
  const context = useContext(AppLanguageContext);
  if (!context) {
    throw new Error('useAppLanguage must be used inside AppLanguageProvider');
  }
  return context;
}
