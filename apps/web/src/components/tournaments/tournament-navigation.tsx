'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { FcContextNav } from '@/components/fc/fc-context-nav';
import { authenticatedRequest } from '@/lib/auth-client';
import { isRoundRobinLeague, hasKnockoutStage as isKnockoutFormat } from '@/lib/tournament-ui-context';

interface Props {
  tournamentId: string;
}

interface NavigationContext {
  tournamentId: string;
  competitionFormat: string;
  groupCount: number;
}

const items = [
  ['Overview', ''],
  ['Registration', '/registration'],
  ['Teams', '/teams'],
  ['Groups', '/groups'],
  ['Fixtures', '/fixtures'],
  ['Standings', '/standings'],
  ['Bracket', '/playoffs'],
  ['Stats', '/stats'],
  ['Summary', '/summary'],
  ['Report', '/report'],
  ['Awards', '/achievements'],
  ['Settings', '/settings'],
  ['Manage Admins', '/admins'],
] as const;

export function TournamentNavigation({ tournamentId }: Props) {
  const pathname = usePathname();
  const [context, setContext] = useState<NavigationContext | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    // The stored groupMode can say MULTIPLE_GROUPS on an older single-table
    // tournament. Only actual configured groups determine if Groups applies.
    void Promise.all([
      authenticatedRequest<{ data: { tournament: { competitionFormat: string } } }>(
        `/tournaments/${tournamentId}`, { signal: controller.signal },
      ),
      authenticatedRequest<{ data: { groups: Array<{ id: string }> } }>(
        `/tournaments/${tournamentId}/groups`, { signal: controller.signal },
      ),
    ]).then(([tournamentResponse, groupResponse]) => {
      if (!controller.signal.aborted) {
        setContext({
          tournamentId,
          competitionFormat: tournamentResponse.data.tournament.competitionFormat,
          groupCount: groupResponse.data.groups.length,
        });
      }
    }).catch(() => {
      // Keep links available if context refresh fails. Never alter fixtures.
    });

    return () => controller.abort();
  }, [tournamentId]);

  const current = context?.tournamentId === tournamentId ? context : null;
  const isLeagueWithoutGroups = Boolean(current
    && isRoundRobinLeague(current.competitionFormat) && current.groupCount === 0);
  const hasKnockoutStage = !current || isKnockoutFormat(current.competitionFormat);
  const base = `/tournaments/${tournamentId}`;

  return (
    <FcContextNav
      ariaLabel="Tournament sections"
      items={items
        .filter(([label]) => (
          (label !== 'Groups' || !isLeagueWithoutGroups)
          && (label !== 'Bracket' || hasKnockoutStage)
        ))
        .map(([label, suffix]) => {
          const href = `${base}${suffix}`;
          const active = suffix === ''
            ? pathname === base
            : pathname === href || pathname.startsWith(`${href}/`);
          return { label, href, active };
        })}
    />
  );
}
