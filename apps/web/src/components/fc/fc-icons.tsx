'use client';

import type {
  ReactNode,
} from 'react';

export type FcIconName =
  | 'activity'
  | 'alert'
  | 'announcement'
  | 'award'
  | 'bell'
  | 'calendar'
  | 'chart'
  | 'check'
  | 'chevronDown'
  | 'chevronRight'
  | 'document'
  | 'fixtures'
  | 'football'
  | 'help'
  | 'history'
  | 'home'
  | 'info'
  | 'join'
  | 'league'
  | 'leaderboard'
  | 'lock'
  | 'logout'
  | 'more'
  | 'plus'
  | 'profile'
  | 'result'
  | 'search'
  | 'settings'
  | 'shield'
  | 'team'
  | 'tournament'
  | 'trophy';

const legacyMap:
  Record<string, FcIconName> = {
    '◎': 'profile',
    '▥': 'chart',
    '↺': 'history',
    '★': 'award',
    '🏆': 'trophy',
    '⚔': 'result',
    '✓': 'check',
    '⚽': 'football',
    '≣': 'leaderboard',
    '◈': 'league',
    '◇': 'tournament',
    '+': 'plus',
    '●': 'bell',
    '⌁': 'announcement',
    '⚙': 'settings',
    '!': 'alert',
    '◉': 'shield',
    '?': 'help',
    'i': 'info',
    '▤': 'fixtures',
    '↗': 'chart',
    '✦': 'activity',
    'document': 'document',
    'activity': 'activity',
    'award': 'award',
    'bell': 'bell',
    'calendar': 'calendar',
    'chart': 'chart',
    'check': 'check',
    'fixtures': 'fixtures',
    'football': 'football',
    'help': 'help',
    'history': 'history',
    'home': 'home',
    'info': 'info',
    'join': 'join',
    'league': 'league',
    'leaderboard': 'leaderboard',
    'lock': 'lock',
    'logout': 'logout',
    'more': 'more',
    'plus': 'plus',
    'profile': 'profile',
    'result': 'result',
    'search': 'search',
    'settings': 'settings',
    'shield': 'shield',
    'team': 'team',
    'tournament': 'tournament',
    'trophy': 'trophy',
  };

export function iconNameFromLegacy(
  value:
    ReactNode,
  fallback:
    FcIconName =
      'activity',
): FcIconName {
  return typeof value ===
    'string'
    ? legacyMap[value] ??
        fallback
    : fallback;
}

export function FcIcon({
  name,
  size = 20,
  className = '',
  title,
}: {
  name: FcIconName;
  size?: number;
  className?: string;
  title?: string;
}) {
  const common = {
    viewBox:
      '0 0 24 24',
    width:
      size,
    height:
      size,
    className,
    fill:
      'none',
    stroke:
      'currentColor',
    strokeWidth:
      1.8,
    strokeLinecap:
      'round' as const,
    strokeLinejoin:
      'round' as const,
    'aria-hidden':
      title
        ? undefined
        : true,
    role:
      title
        ? 'img'
        : undefined,
  };

  let content:
    ReactNode;

  switch (name) {
    case 'home':
      content = (
        <>
          <path d="m3 10.5 9-7 9 7" />
          <path d="M5.5 9.5V21h13V9.5" />
          <path d="M9.5 21v-6h5v6" />
        </>
      );
      break;

    case 'league':
    case 'shield':
      content = (
        <>
          <path d="M12 3 4.5 6v5.2c0 4.6 3.1 8 7.5 9.8 4.4-1.8 7.5-5.2 7.5-9.8V6L12 3Z" />
          <path d="m8.5 11 2.1 2.1 4.9-5" />
        </>
      );
      break;

    case 'tournament':
    case 'trophy':
    case 'award':
      content = (
        <>
          <path d="M8 4h8v3.2c0 3.3-1.8 5.7-4 6.8-2.2-1.1-4-3.5-4-6.8V4Z" />
          <path d="M8 6H4.5v1.2c0 2.4 1.5 4.2 4.2 4.8" />
          <path d="M16 6h3.5v1.2c0 2.4-1.5 4.2-4.2 4.8" />
          <path d="M12 14v4" />
          <path d="M8.5 21h7" />
        </>
      );
      break;

    case 'fixtures':
    case 'calendar':
      content = (
        <>
          <rect
            x="3"
            y="5.5"
            width="18"
            height="15.5"
            rx="2.5"
          />
          <path d="M7 3v5M17 3v5M3 10h18" />
          <path d="m8.5 15 2 2 5-5" />
        </>
      );
      break;

    case 'football':
      content = (
        <>
          <circle
            cx="12"
            cy="12"
            r="9"
          />
          <path d="m12 7 3.2 2.3-1.2 3.8h-4l-1.2-3.8L12 7Z" />
          <path d="m8.8 9.3-3.2-.4M15.2 9.3l3.2-.4M10 13.1l-1.7 3.2M14 13.1l1.7 3.2M8.3 16.3l-1.3 1.8M15.7 16.3l1.3 1.8" />
        </>
      );
      break;

    case 'profile':
      content = (
        <>
          <circle
            cx="12"
            cy="8"
            r="3.5"
          />
          <path d="M4.5 20c.9-4 3.4-6 7.5-6s6.6 2 7.5 6" />
        </>
      );
      break;

    case 'team':
    case 'join':
      content = (
        <>
          <circle
            cx="9"
            cy="8"
            r="3"
          />
          <path d="M3.5 19c.7-3.1 2.6-4.8 5.5-4.8 2.2 0 3.9 1 4.9 2.8" />
          <circle
            cx="17.5"
            cy="9"
            r="2.3"
          />
          <path d="M15.5 15c2.8-.6 5 .7 5.8 3.6" />
          {name ===
          'join' ? (
            <path d="M18 3.5v4M16 5.5h4" />
          ) : null}
        </>
      );
      break;

    case 'chart':
    case 'leaderboard':
      content = (
        <>
          <path d="M4 20V10M10 20V5M16 20v-8M22 20H2" />
          <path d="m4 8 5-4 5 3 6-5" />
        </>
      );
      break;

    case 'history':
      content = (
        <>
          <path d="M4 7v5h5" />
          <path d="M5.5 17a8 8 0 1 0-1.2-8" />
          <path d="M12 7v5l3 2" />
        </>
      );
      break;

    case 'result':
    case 'check':
      content = (
        <>
          <circle
            cx="12"
            cy="12"
            r="9"
          />
          <path d="m8 12.5 2.6 2.6L16.5 9" />
        </>
      );
      break;

    case 'search':
      content = (
        <>
          <circle
            cx="11"
            cy="11"
            r="6.5"
          />
          <path d="m16 16 4.5 4.5" />
        </>
      );
      break;

    case 'bell':
      content = (
        <>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </>
      );
      break;

    case 'settings':
      content = (
        <>
          <circle
            cx="12"
            cy="12"
            r="3"
          />
          <path d="M19 12a7.6 7.6 0 0 0-.1-1.2l2-1.5-2-3.4-2.4 1a8 8 0 0 0-2-1.2L14.2 3h-4.4l-.4 2.7a8 8 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.5A7.6 7.6 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.4-1a8 8 0 0 0 2 1.2l.4 2.7h4.4l.4-2.7a8 8 0 0 0 2-1.2l2.4 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z" />
        </>
      );
      break;

    case 'help':
      content = (
        <>
          <circle
            cx="12"
            cy="12"
            r="9"
          />
          <path d="M9.7 9a2.4 2.4 0 0 1 4.7.7c0 1.8-2.4 2.2-2.4 3.8" />
          <path d="M12 17h.01" />
        </>
      );
      break;

    case 'info':
      content = (
        <>
          <circle
            cx="12"
            cy="12"
            r="9"
          />
          <path d="M12 10v6M12 7h.01" />
        </>
      );
      break;

    case 'alert':
      content = (
        <>
          <path d="M12 3 2.8 20h18.4L12 3Z" />
          <path d="M12 9v5M12 17h.01" />
        </>
      );
      break;

    case 'announcement':
      content = (
        <>
          <path d="m4 13 13-5v8L4 11v2Z" />
          <path d="M7 13.5 8.5 20h3L10 14.6" />
          <path d="M19 9.5c1 .7 1.5 1.5 1.5 2.5s-.5 1.8-1.5 2.5" />
        </>
      );
      break;

    case 'document':
      content = (
        <>
          <path d="M6 3h8l4 4v14H6V3Z" />
          <path d="M14 3v5h5M9 12h6M9 16h6" />
        </>
      );
      break;

    case 'lock':
      content = (
        <>
          <rect
            x="5"
            y="10"
            width="14"
            height="10"
            rx="2"
          />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </>
      );
      break;

    case 'logout':
      content = (
        <>
          <path d="M10 5H5.5A1.5 1.5 0 0 0 4 6.5v11A1.5 1.5 0 0 0 5.5 19H10" />
          <path d="m14 8 4 4-4 4M9 12h9" />
        </>
      );
      break;

    case 'plus':
      content = (
        <path d="M12 5v14M5 12h14" />
      );
      break;

    case 'chevronRight':
      content = (
        <path d="m9 18 6-6-6-6" />
      );
      break;

    case 'chevronDown':
      content = (
        <path d="m6 9 6 6 6-6" />
      );
      break;

    case 'more':
      return (
        <svg
          {...common}
          fill="currentColor"
          stroke="none"
        >
          {title ? (
            <title>
              {title}
            </title>
          ) : null}
          <circle
            cx="5"
            cy="12"
            r="1.6"
          />
          <circle
            cx="12"
            cy="12"
            r="1.6"
          />
          <circle
            cx="19"
            cy="12"
            r="1.6"
          />
        </svg>
      );

    case 'activity':
    default:
      content = (
        <>
          <path d="M3 12h4l2-5 4 10 2-5h6" />
        </>
      );
      break;
  }

  return (
    <svg
      {...common}
    >
      {title ? (
        <title>
          {title}
        </title>
      ) : null}
      {content}
    </svg>
  );
}
