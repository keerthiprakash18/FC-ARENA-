import type {
  FcIconName,
} from '@/components/fc/fc-icons';

export interface PrimaryNavigationItem {
  label: string;
  shortLabel: string;
  href: string;
  icon: FcIconName;
}

export const primaryNavigation:
  PrimaryNavigationItem[] = [
    {
      label: 'HOME',
      shortLabel: 'Home',
      href: '/dashboard',
      icon: 'home',
    },
    {
      label: 'LEAGUE',
      shortLabel: 'League',
      href: '/leagues',
      icon: 'league',
    },
    {
      label: 'TOURNAMENT',
      shortLabel: 'Cup',
      href: '/tournaments',
      icon: 'tournament',
    },
    {
      label: 'FIXTURES',
      shortLabel: 'Matches',
      href: '/fixtures',
      icon: 'fixtures',
    },
    {
      label: 'AWARDS',
      shortLabel: 'Awards',
      href: '/awards',
      icon: 'award',
    },
    {
      label: 'LEAGUE WAR',
      shortLabel: 'War',
      href: '/league-war',
      icon: 'war',
    },
    {
      label: 'MORE',
      shortLabel: 'More',
      href: '/more',
      icon: 'more',
    },
  ];

// The product destinations have the same direct access on every screen size.
export const mobilePrimaryNavigation = primaryNavigation;

export function getActivePrimarySection(
  pathname: string,
) {
  if (pathname === '/dashboard') {
    return '/dashboard';
  }

  if (pathname.startsWith('/leagues')) {
    return '/leagues';
  }

  if (pathname.startsWith('/tournaments')) {
    return '/tournaments';
  }

  if (pathname.startsWith('/league-war')) {
    return '/league-war';
  }

  if (
    pathname.startsWith('/fixtures') ||
    pathname.startsWith('/matches')
  ) {
    return '/fixtures';
  }

  if (pathname.startsWith('/awards')) {
    return '/awards';
  }

  return '/more';
}

export function shouldShowPrimaryBottomNavigation(
  pathname: string,
) {
  return pathname.startsWith('/');
}
