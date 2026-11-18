'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { FcContextNav } from '@/components/fc/fc-context-nav';
import { authenticatedRequest } from '@/lib/auth-client';
import { hasKnockoutStage as isKnockoutFormat } from '@/lib/tournament-ui-context';

interface Props { tournamentId: string }
interface NavigationContext {
  tournamentId: string;
  competitionFormat: string;
  groupCount: number;
  canManageSettings: boolean;
  canManageAdmins: boolean;
}

// Player-facing actions belong first. Management and historic screens remain
// accessible, but do not consume thirteen always-visible tournament tabs.
const primaryItems = [
  ['Overview', ''],
  ['Fixtures', '/fixtures'],
  ['Standings', '/standings'],
  ['Bracket', '/playoffs'],
  ['Awards', '/achievements'],
] as const;

const tools = [
  ['Registration', '/registration'],
  ['Teams', '/teams'],
  ['Groups', '/groups'],
  ['Stats', '/stats'],
  ['Summary', '/summary'],
  ['Report', '/report'],
  ['Settings', '/settings'],
  ['Manage Admins', '/admins'],
] as const;

export function TournamentNavigation({ tournamentId }: Props) {
  const pathname = usePathname();
  const [context, setContext] = useState<NavigationContext | null>(null);

  useEffect(() => {
    let controller: AbortController | null = null;
    function refresh() {
      controller?.abort();
      controller = new AbortController();
      const signal = controller.signal;
      void Promise.all([
        authenticatedRequest<{ data: { tournament: {
          competitionFormat: string; canManageSettings?: boolean; canManageAdmins?: boolean;
        } } }>(`/tournaments/${tournamentId}`, { signal }),
        authenticatedRequest<{ data: { groups: Array<{ id: string }> } }>(
          `/tournaments/${tournamentId}/groups`, { signal },
        ),
      ]).then(([tournamentResponse, groupResponse]) => {
        if (!signal.aborted) {
          setContext({
            tournamentId,
            competitionFormat: tournamentResponse.data.tournament.competitionFormat,
            groupCount: groupResponse.data.groups.length,
            canManageSettings: Boolean(tournamentResponse.data.tournament.canManageSettings),
            canManageAdmins: Boolean(tournamentResponse.data.tournament.canManageAdmins),
          });
        }
      }).catch(() => {
        // Fail open for navigation links if an API request fails; all protected
        // backend endpoints still enforce permissions independently.
      });
    }
    refresh();
    const onUpdated = (event: Event) => {
      if ((event as CustomEvent<{ tournamentId?: string }>).detail?.tournamentId === tournamentId) {
        refresh();
      }
    };
    window.addEventListener('fcarena:tournament-updated', onUpdated);
    return () => {
      controller?.abort();
      window.removeEventListener('fcarena:tournament-updated', onUpdated);
    };
  }, [tournamentId]);

  const current = context?.tournamentId === tournamentId ? context : null;
  const base = `/tournaments/${tournamentId}`;
  const isActive = (suffix: string) => {
    const href = base + suffix;
    return suffix === '' ? pathname === base : pathname === href || pathname.startsWith(href + '/');
  };
  const showPrimary = ([label]: readonly [string, string]) =>
    label !== 'Bracket' || !current || isKnockoutFormat(current.competitionFormat);
  const showTool = ([label]: readonly [string, string]) =>
    (label !== 'Groups' || !current || current.groupCount > 0)
    && (label !== 'Settings' || !current || current.canManageSettings)
    && (label !== 'Manage Admins' || !current || current.canManageAdmins);
  const moreItems = tools.filter(showTool);
  const activeTool = moreItems.find(([, suffix]) => isActive(suffix));

  return (
    <div className="space-y-2">
      <FcContextNav
        ariaLabel="Tournament main sections"
        items={primaryItems.filter(showPrimary).map(([label, suffix]) => ({
          label, href: base + suffix, active: isActive(suffix),
        }))}
      />
      <details className="theme-panel rounded-xl border px-3 py-2 text-sm">
        <summary className="cursor-pointer font-semibold text-slate-300">
          More tournament sections{activeTool ? ` · ${activeTool[0]}` : ''}
        </summary>
        <nav aria-label="More tournament sections" className="mt-3 flex flex-wrap gap-2 border-t border-white/10 pt-3">
          {moreItems.map(([label, suffix]) => (
            <Link key={suffix} href={base + suffix} aria-current={isActive(suffix) ? 'page' : undefined}
              className={`inline-flex min-h-10 items-center rounded-lg border px-3 text-xs font-bold transition-colors ${isActive(suffix)
                ? 'border-amber-400/40 bg-amber-400/10 text-amber-200'
                : 'border-white/10 text-slate-300 hover:border-white/25'}`}>
              {label}
            </Link>
          ))}
        </nav>
      </details>
    </div>
  );
}
