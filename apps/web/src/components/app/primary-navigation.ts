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
      label: 'ELITE CUP',
      shortLabel: 'Elite',
      href: '/elite-cup',
      icon: 'tournament',
    },
    {
      label: 'UCL CUP',
      shortLabel: 'UCL',
      href: '/ucl-cup',
      icon: 'tournament',
    },
    {
      label: 'FIXTURES',
      shortLabel: 'Matches',
      href: '/fixtures',
      icon: 'fixtures',
    },
    {
      label: 'MORE',
      shortLabel: 'More',
      href: '/more',
      icon: 'more',
    },
  ];

// Keep the mobile rail focused. Competition hubs remain directly available in
// the desktop sidebar and from the More page without collapsing the five-slot
// mobile layout that is used by the Android shell.
export const mobilePrimaryNavigation = primaryNavigation.filter(
  (item) => item.href !== '/elite-cup' && item.href !== '/ucl-cup',
);

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

  if (pathname.startsWith('/elite-cup')) {
    return '/elite-cup';
  }

  if (pathname.startsWith('/ucl-cup')) {
    return '/ucl-cup';
  }

  if (
    pathname.startsWith('/fixtures') ||
    pathname.startsWith('/matches')
  ) {
    return '/fixtures';
  }

  return '/more';
}

export function shouldShowPrimaryBottomNavigation(
  pathname: string,
) {
  return pathname.startsWith('/');
}
