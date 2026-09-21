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
      label:
        'HOME',
      shortLabel:
        'Home',
      href:
        '/dashboard',
      icon:
        'home',
    },
    {
      label:
        'LEAGUE',
      shortLabel:
        'League',
      href:
        '/leagues',
      icon:
        'league',
    },
    {
      label:
        'TOURNAMENT',
      shortLabel:
        'Tournament',
      href:
        '/tournaments',
      icon:
        'tournament',
    },
    {
      label:
        'FIXTURES',
      shortLabel:
        'Fixtures',
      href:
        '/fixtures',
      icon:
        'fixtures',
    },
    {
      label:
        'MORE',
      shortLabel:
        'More',
      href:
        '/more',
      icon:
        'more',
    },
  ];

export function getActivePrimarySection(
  pathname: string,
) {
  if (
    pathname ===
    '/dashboard'
  ) {
    return '/dashboard';
  }

  if (
    pathname.startsWith(
      '/leagues',
    )
  ) {
    return '/leagues';
  }

  if (
    pathname.startsWith(
      '/tournaments',
    )
  ) {
    return '/tournaments';
  }

  if (
    pathname.startsWith(
      '/fixtures',
    ) ||
    pathname.startsWith(
      '/matches',
    )
  ) {
    return '/fixtures';
  }

  return '/more';
}

export function shouldShowPrimaryBottomNavigation(
  pathname: string,
) {
  return [
    '/dashboard',
    '/leagues',
    '/tournaments',
    '/fixtures',
    '/more',
  ].includes(
    pathname,
  );
}
