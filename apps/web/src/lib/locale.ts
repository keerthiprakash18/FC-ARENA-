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
  | 'myNextSteps' | 'nextMatch' | 'viewMatch' | 'tournamentRules'
  | 'clubsIntro' | 'shareInvitePrivate' | 'joinSuccess' | 'createHeading' | 'joinHeading' | 'memberInviteHelp'
  | 'clubCaptain' | 'captainControls' | 'clubRoster' | 'rotateInvite' | 'inviteRotated' | 'inviteOneTime'
  | 'inviteOneTimeHelp' | 'copyInvite' | 'linkTeamHeading' | 'linkTeamHint' | 'selectTeam' | 'linkTeam'
  | 'noLinkable' | 'linkedHistory' | 'noEntries' | 'members' | 'linkedEntries' | 'myClub'
  | 'loadingClubs' | 'noClubs' | 'createFirstClub' | 'createClubHelp' | 'joinClubHelp' | 'descriptionOptional'
  | 'descriptionPlaceholder' | 'clubStatsVerified' | 'verifiedGames' | 'wins' | 'goalsFor' | 'winRate'
  | 'teamLinked' | 'seasonHistory' | 'seasonIntro' | 'loadingSeasons' | 'noOfficialSeason' | 'noSeasonHelp'
  | 'openCareer' | 'shareSeason' | 'officialSeason' | 'seasonProgress' | 'matches' | 'teamGoals'
  | 'draws' | 'losses' | 'officialFinalRank' | 'seasonEvidence' | 'recentSeasonMatches' | 'noSeasonMatches'
  | 'viewCareer' | 'verifiedScore' | 'awaitingResult' | 'kickoffPending' | 'spectatorDescription' | 'offlineLast'
  | 'connectionIssue' | 'publicData' | 'matchCenterUnavailable' | 'publicOnly' | 'notStarted' | 'linkCompetition';

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
  tournamentRules: 'Tournament Rules',  clubsIntro: "Create a permanent club and link approved DUO / TEAM entries. Historical results are never inferred from a matching name.",
  shareInvitePrivate: "Club created. Share your invitation privately with trusted teammates.",
  joinSuccess: "Joined club successfully.",
  createHeading: "Create a club",
  joinHeading: "Join a club",
  memberInviteHelp: "Ask your captain for the private 24-character invitation code.",
  clubCaptain: "Club captain",
  captainControls: "Captain controls",
  clubRoster: "Club roster",
  rotateInvite: "Regenerate private invitation code",
  inviteRotated: "The previous code is invalid. Copy the new private code now.",
  inviteOneTime: "This invitation code is shown only once.",
  inviteOneTimeHelp: "Copy it now or regenerate a new one from the club profile.",
  copyInvite: "Copy invitation code",
  linkTeamHeading: "Link an approved DUO / TEAM tournament entry",
  linkTeamHint: "All registered teammates must already belong to this club. Completed or verified entries cannot be claimed retroactively.",
  selectTeam: "Select approved team",
  linkTeam: "Link team",
  noLinkable: "No eligible unlinked DUO / TEAM entries.",
  linkedHistory: "Linked tournament history",
  noEntries: "No linked tournament registrations yet.",
  members: "members",
  linkedEntries: "linked entries",
  myClub: "Your club",
  loadingClubs: "Loading clubs…",
  noClubs: "No clubs yet",
  createFirstClub: "Create the first permanent FC ARENA club.",
  createClubHelp: "Lead your team. Members join by invitation.",
  joinClubHelp: "Joining requires a private invitation code.",
  descriptionOptional: "Description (optional)",
  descriptionPlaceholder: "What is your club about?",
  clubStatsVerified: "Club statistics only include confirmed results from explicitly linked registrations.",
  verifiedGames: "Verified games",
  wins: "Wins",
  goalsFor: "Goals for",
  winRate: "Win rate",
  teamLinked: "Official tournament entry linked to your club.",
  seasonHistory: "Verified season history",
  seasonIntro: "Real results from official Ballon seasons, including only verified player matches in eligible tournaments.",
  loadingSeasons: "Loading official seasons…",
  noOfficialSeason: "No official season available",
  noSeasonHelp: "Your season recap appears when an administrator publishes an official Ballon season. Career history remains available.",
  openCareer: "Open career",
  shareSeason: "Share season recap",
  officialSeason: "Official season",
  seasonProgress: "Season progress to date",
  matches: "Matches",
  teamGoals: "Team goals",
  draws: "Draws",
  losses: "Losses",
  officialFinalRank: "Official final ranking",
  seasonEvidence: "Confirmed scores only. Team goals are not individual Golden Boot goals. Unfinished seasons have no official final placement.",
  recentSeasonMatches: "Recent verified season matches",
  noSeasonMatches: "No verified matches in the eligible competitions this season.",
  viewCareer: "View full career",
  verifiedScore: "Verified score",
  awaitingResult: "Awaiting verified result. Scores are not published until approval.",
  kickoffPending: "Kickoff pending",
  spectatorDescription: "Public fixture schedule and verified scores. Live status does not imply real-time goals.",
  offlineLast: "Offline — last loaded scoreboard",
  connectionIssue: "Connection issue — showing previous results",
  publicData: "Public verified matchday data",
  matchCenterUnavailable: "Match center unavailable",
  publicOnly: "Only explicitly public tournaments can be viewed without a player account.",
  notStarted: "Not started",
  linkCompetition: "View competition",
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
  tournamentRules: 'போட்டி விதிகள்',  clubsIntro: "நிரந்தர கிளப்பை உருவாக்கி, அங்கீகரிக்கப்பட்ட இருவர் / அணி போட்டிகளை இணைக்கலாம். பெயர் ஒத்திருப்பதால் பழைய முடிவுகள் சேர்க்கப்படாது.",
  shareInvitePrivate: "கிளப் உருவாக்கப்பட்டது. நம்பகமான அணி உறுப்பினர்களுடன் அழைப்புக் குறியீட்டைப் பகிருங்கள்.",
  joinSuccess: "கிளப்பில் வெற்றிகரமாக இணைந்துவிட்டீர்கள்.",
  createHeading: "கிளப்பை உருவாக்கு",
  joinHeading: "கிளப்பில் இணை",
  memberInviteHelp: "உங்கள் கேப்டனிடம் 24 எழுத்துகளைக் கொண்ட தனிப்பட்ட அழைப்புக் குறியீட்டைக் கேளுங்கள்.",
  clubCaptain: "கிளப் கேப்டன்",
  captainControls: "கேப்டன் கட்டுப்பாடுகள்",
  clubRoster: "கிளப் வீரர்கள்",
  rotateInvite: "புதிய தனிப்பட்ட அழைப்புக் குறியீடு",
  inviteRotated: "பழைய குறியீடு செல்லாது. புதிய குறியீட்டை இப்போதே நகலெடுக்கவும்.",
  inviteOneTime: "இந்த அழைப்புக் குறியீடு ஒருமுறை மட்டுமே காட்டப்படும்.",
  inviteOneTimeHelp: "இப்போது நகலெடுக்கவும்; தேவைப்பட்டால் கிளப் பக்கத்தில் புதிய குறியீடு உருவாக்கலாம்.",
  copyInvite: "அழைப்புக் குறியீட்டை நகலெடு",
  linkTeamHeading: "அங்கீகரிக்கப்பட்ட இருவர் / அணிப் போட்டியை இணைக்கவும்",
  linkTeamHint: "போட்டியில் பதிவு செய்யப்பட்ட அனைவரும் இந்த கிளப்பில் இருக்க வேண்டும். முடிந்த அல்லது உறுதிசெய்யப்பட்ட போட்டியைப் பின்னர் இணைக்க முடியாது.",
  selectTeam: "அங்கீகரிக்கப்பட்ட அணியைத் தேர்வு செய்",
  linkTeam: "அணியை இணை",
  noLinkable: "இணைக்கக்கூடிய இருவர் / அணிப் பதிவுகள் இல்லை.",
  linkedHistory: "இணைக்கப்பட்ட போட்டித் தொடர்கள்",
  noEntries: "இன்னும் எந்தப் போட்டித் தொடரும் இணைக்கப்படவில்லை.",
  members: "உறுப்பினர்கள்",
  linkedEntries: "இணைக்கப்பட்ட போட்டிகள்",
  myClub: "உங்கள் கிளப்",
  loadingClubs: "கிளப்புகள் ஏற்றப்படுகின்றன…",
  noClubs: "இன்னும் கிளப்புகள் இல்லை",
  createFirstClub: "முதல் நிரந்தர FC ARENA கிளப்பை உருவாக்குங்கள்.",
  createClubHelp: "உங்கள் அணியை வழிநடத்துங்கள். உறுப்பினர்கள் அழைப்புடன் இணையலாம்.",
  joinClubHelp: "கிளப்பில் சேர தனிப்பட்ட அழைப்புக் குறியீடு தேவை.",
  descriptionOptional: "விளக்கம் (விருப்பம்)",
  descriptionPlaceholder: "உங்கள் கிளப்பைப் பற்றி எழுதுங்கள்",
  clubStatsVerified: "வெளிப்படையாக இணைக்கப்பட்ட அணிகளின் உறுதிசெய்யப்பட்ட போட்டி முடிவுகள் மட்டுமே கணக்கிடப்படும்.",
  verifiedGames: "சரிபார்த்த போட்டிகள்",
  wins: "வெற்றிகள்",
  goalsFor: "அடித்த கோல்கள்",
  winRate: "வெற்றி விகிதம்",
  teamLinked: "அதிகாரப்பூர்வ அணிப் பதிவு கிளப்புடன் இணைக்கப்பட்டது.",
  seasonHistory: "உறுதிசெய்யப்பட்ட சீசன் வரலாறு",
  seasonIntro: "அதிகாரப்பூர்வ Ballon சீசன்களில் தகுதியான போட்டிகளின் சரிபார்க்கப்பட்ட முடிவுகள் மட்டுமே இடம்பெறும்.",
  loadingSeasons: "சீசன்கள் ஏற்றப்படுகின்றன…",
  noOfficialSeason: "இன்னும் அதிகாரப்பூர்வ சீசன் இல்லை",
  noSeasonHelp: "நிர்வாகி அதிகாரப்பூர்வ Ballon சீசனை வெளியிட்டதும் சுருக்கம் காணலாம். பழைய வீரர் சாதனைகள் தொடர்ந்தும் கிடைக்கும்.",
  openCareer: "வீரர் சாதனைகள்",
  shareSeason: "சீசன் சுருக்கத்தைப் பகிர்",
  officialSeason: "அதிகாரப்பூர்வ சீசன்",
  seasonProgress: "இதுவரையிலான சீசன் செயல்பாடு",
  matches: "போட்டிகள்",
  teamGoals: "அணி கோல்கள்",
  draws: "சமநிலைகள்",
  losses: "தோல்விகள்",
  officialFinalRank: "அதிகாரப்பூர்வ இறுதித் தரவரிசை",
  seasonEvidence: "உறுதிசெய்யப்பட்ட முடிவுகள் மட்டும். அணி கோல்கள் தனிநபர் Golden Boot கோல்கள் அல்ல. முடியாத சீசனுக்கு இறுதித் தரவரிசை இல்லை.",
  recentSeasonMatches: "சமீபத்திய சரிபார்த்த சீசன் போட்டிகள்",
  noSeasonMatches: "இந்தச் சீசனின் தகுதியான போட்டிகளில் சரிபார்க்கப்பட்ட முடிவுகள் இல்லை.",
  viewCareer: "முழு வீரர் சாதனை வரலாறு",
  verifiedScore: "சரிபார்த்த முடிவு",
  awaitingResult: "சரிபார்த்த முடிவுக்காகக் காத்திருக்கிறது. நிர்வாக அங்கீகாரம் வரை கோல்கள் காட்டப்படாது.",
  kickoffPending: "தொடக்க நேரம் அறிவிக்கப்படவில்லை",
  spectatorDescription: "பொது போட்டி அட்டவணையும் உறுதிசெய்யப்பட்ட முடிவுகளும். LIVE நிலை நேரடி கோல் எண்ணிக்கை அல்ல.",
  offlineLast: "இணையம் இல்லை — கடைசியாக ஏற்றிய முடிவு",
  connectionIssue: "இணைப்புச் சிக்கல் — முந்தைய முடிவுகள் காட்டப்படுகின்றன",
  publicData: "சரிபார்த்த பொது போட்டித் தகவல்கள்",
  matchCenterUnavailable: "போட்டி மையம் கிடைக்கவில்லை",
  publicOnly: "PUBLIC எனக் குறிக்கப்பட்ட போட்டிகளை மட்டுமே உள்நுழையாமல் பார்க்க முடியும்.",
  notStarted: "தொடங்கவில்லை",
  linkCompetition: "போட்டித் தொடரைக் காண்",
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
  const locale = useSyncExternalStore<ArenaLocale>(subscribe, current, () => 'en');
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
