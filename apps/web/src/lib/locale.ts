'use client';

import { useSyncExternalStore } from 'react';

export type ArenaLocale = 'en' | 'ta';
export type TranslationKey =
  | 'home' | 'leagues' | 'tournaments' | 'fixtures' | 'awards' | 'more' | 'discover'
  | 'dashboard' | 'quickActions' | 'signOut' | 'signingOut' | 'playerJourney'
  | 'careerStats' | 'seasonRecaps' | 'clubs' | 'clubsDescription'
  | 'createClub' | 'joinClub' | 'clubName' | 'invitationCode' | 'permanentClubs'
  | 'matchday' | 'verifiedResults' | 'upcoming' | 'liveFixtures'
  | 'spectator' | 'openTournament' | 'refresh' | 'loading' | 'profile'
  | 'theme' | 'language' | 'english' | 'tamil' | 'teams'
  | 'myProfile' | 'matchHistory' | 'achievements' | 'hallOfFame' | 'leaderboards'
  | 'noLiveMatches' | 'noUpcomingMatches' | 'noVerifiedResults'
  | 'myNextSteps' | 'nextMatch' | 'viewMatch' | 'tournamentRules';

const en: Record<TranslationKey, string> = {
  home: 'Home', leagues: 'Leagues', tournaments: 'Tournaments', fixtures: 'Fixtures',
  awards: 'Awards', more: 'More', discover: 'Discover', dashboard: 'Dashboard',
  quickActions: 'Quick Actions', signOut: 'Sign Out', signingOut: 'Signing out…',
  playerJourney: 'Player Journey', careerStats: 'Career Stats', seasonRecaps: 'Season Recaps',
  clubs: 'FC ARENA Clubs', clubsDescription: 'Permanent teams, members and verified history',
  createClub: 'Create Club', joinClub: 'Join Club', clubName: 'Club name',
  invitationCode: 'Invitation code', permanentClubs: 'Permanent Clubs',
  matchday: 'Matchday', verifiedResults: 'Verified Results', upcoming: 'Upcoming',
  liveFixtures: 'Live Fixtures', spectator: 'Spectator Match Center',
  openTournament: 'Full Tournament', refresh: 'Refresh', loading: 'Loading…',
  profile: 'Profile', theme: 'Theme', language: 'Language',
  english: 'English', tamil: 'தமிழ்', teams: 'Teams', myProfile: 'My Profile',
  matchHistory: 'Match History', achievements: 'Achievements', hallOfFame: 'Hall of Fame',
  leaderboards: 'Leaderboards', noLiveMatches: 'No live fixtures',
  noUpcomingMatches: 'No upcoming fixtures', noVerifiedResults: 'No verified results',
  myNextSteps: 'Your next steps', nextMatch: 'Next Match', viewMatch: 'View Match',
  tournamentRules: 'Tournament Rules',
};
const ta: Record<TranslationKey, string> = {
  home: 'முகப்பு', leagues: 'லீக்குகள்', tournaments: 'போட்டிகள்', fixtures: 'போட்டி அட்டவணை',
  awards: 'விருதுகள்', more: 'மேலும்', discover: 'தேடல்', dashboard: 'முகப்புப் பலகை',
  quickActions: 'விரைவு செயல்கள்', signOut: 'வெளியேறு', signingOut: 'வெளியேறுகிறது…',
  playerJourney: 'வீரர் பயணம்', careerStats: 'வீரர் புள்ளிவிவரங்கள்', seasonRecaps: 'சீசன் சுருக்கம்',
  clubs: 'FC ARENA கிளப்புகள்', clubsDescription: 'நிரந்தர அணிகள், உறுப்பினர்கள், உறுதிசெய்யப்பட்ட சாதனைகள்',
  createClub: 'கிளப் உருவாக்கு', joinClub: 'கிளப்பில் சேர்', clubName: 'கிளப் பெயர்',
  invitationCode: 'அழைப்புக் குறியீடு', permanentClubs: 'நிரந்தர கிளப்புகள்',
  matchday: 'போட்டி நாள்', verifiedResults: 'உறுதிசெய்யப்பட்ட முடிவுகள்', upcoming: 'வரவிருக்கும் போட்டிகள்',
  liveFixtures: 'நடப்பு போட்டிகள்', spectator: 'பார்வையாளர் போட்டி மையம்',
  openTournament: 'முழு போட்டித் தொடர்', refresh: 'புதுப்பி', loading: 'ஏற்றப்படுகிறது…',
  profile: 'சுயவிவரம்', theme: 'தோற்றம்', language: 'மொழி',
  english: 'English', tamil: 'தமிழ்', teams: 'அணிகள்', myProfile: 'என் சுயவிவரம்',
  matchHistory: 'போட்டி வரலாறு', achievements: 'சாதனைகள்', hallOfFame: 'சாதனையாளர் அரங்கம்',
  leaderboards: 'தரவரிசை', noLiveMatches: 'தற்போது நேரடி போட்டிகள் இல்லை',
  noUpcomingMatches: 'வரவிருக்கும் போட்டிகள் இல்லை',
  noVerifiedResults: 'உறுதிசெய்யப்பட்ட முடிவுகள் இல்லை',
  myNextSteps: 'அடுத்து செய்ய வேண்டியது', nextMatch: 'அடுத்த போட்டி', viewMatch: 'போட்டியைக் காண்',
  tournamentRules: 'போட்டி விதிகள்',
};

const key = 'fc-arena-locale-v1';
const eventName = 'fc-arena:locale-changed';

export function translate(locale: ArenaLocale, keyName: TranslationKey): string {
  return (locale === 'ta' ? ta : en)[keyName];
}
function current(): ArenaLocale {
  if (typeof window === 'undefined') return 'en';
  try { return localStorage.getItem(key) === 'ta' ? 'ta' : 'en'; }
  catch { return 'en'; }
}
function subscribe(listener: () => void) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(eventName, listener);
  window.addEventListener('storage', listener);
  return () => { window.removeEventListener(eventName, listener); window.removeEventListener('storage', listener); };
}
export function useArenaLocale() {
  const locale = useSyncExternalStore(subscribe, current, () => 'en');
  const changeLocale = (next: ArenaLocale) => {
    if (typeof window === 'undefined') return;
    try { localStorage.setItem(key, next); } catch {}
    document.documentElement.lang = next === 'ta' ? 'ta' : 'en';
    window.dispatchEvent(new Event(eventName));
  };
  return { locale, t: (name: TranslationKey) => translate(locale, name), changeLocale };
}
export function menuTranslationKey(href: string): TranslationKey | null {
  const map: Record<string, TranslationKey> = {
    '/dashboard': 'home', '/leagues': 'leagues', '/tournaments': 'tournaments',
    '/fixtures': 'fixtures', '/awards': 'awards', '/more': 'more',
    '/discover': 'discover', '/profile': 'profile', '/career': 'careerStats',
    '/career/season-recaps': 'seasonRecaps', '/clubs': 'clubs',
    '/experience': 'playerJourney', '/leaderboards': 'leaderboards',
  };
  return map[href] ?? null;
}
