'use client';

import { useArenaLocale } from '@/lib/locale';

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, t, changeLocale } = useArenaLocale();
  return <label className="inline-flex items-center gap-2 text-xs font-semibold" aria-label="Select FC ARENA interface language">
    {!compact ? <span className="theme-secondary-text">{t('language')}</span> : null}
    <select aria-label={t('language')} value={locale}
      onChange={event => changeLocale(event.target.value as 'en' | 'ta')}
      className="theme-input min-h-11 rounded-xl border border-[var(--theme-control-border)] bg-[var(--theme-surface)] px-2 text-sm font-bold text-[var(--theme-text)]">
      <option value="en">EN</option>
      <option value="ta">தமிழ்</option>
    </select>
  </label>;
}
