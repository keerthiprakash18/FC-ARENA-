'use client';

import Link from 'next/link';
import {
  useParams,
  useRouter,
} from 'next/navigation';
import {
  useEffect,
  useState,
} from 'react';

import {
  AppShell,
} from '@/components/app/app-shell';

import {
  BackHeader,
} from '@/components/app/back-header';

import {
  FcCrest,
  FcLoadingScreen,
  FcPanel,
  FcStatCard,
  FcStatusBadge,
} from '@/components/fc/fc-ui';

import {
  LeagueNavigation,
} from '@/components/leagues/league-navigation';

import {
  authenticatedRequest,
  type CurrentUser,
  getCurrentUser,
} from '@/lib/auth-client';


interface LeagueHome {
  id: string;
  name: string;
  code: string;
  description: string | null;
  region: string | null;
  rules: string | null;
  members: number;
  maxMembers: number;
  pendingApplications: number;
  membershipType:
    | 'PRIMARY'
    | 'SECONDARY';
  adminRole:
    | 'OWNER'
    | 'ADMIN'
    | null;

  creator: {
    id: string;
    fullName: string;
    playerCode: string | null;
    inGameName: string | null;
  };
}


interface TournamentSummary {
  id: string;
  status: string;
}


export default function LeagueOverviewPage() {
  const {
    leagueId,
  } =
    useParams<{
      leagueId:
        string;
    }>();

  const router =
    useRouter();

  const [
    user,
    setUser,
  ] =
    useState<CurrentUser | null>(
      null,
    );

  const [
    league,
    setLeague,
  ] =
    useState<LeagueHome | null>(
      null,
    );

  const [
    tournaments,
    setTournaments,
  ] =
    useState<TournamentSummary[]>(
      [],
    );


  useEffect(() => {
    async function load() {
      try {
        const [
          current,
          leagueResponse,
          tournamentResponse,
        ] =
          await Promise.all([
            getCurrentUser(),

            authenticatedRequest<{
              success: true;
              data: {
                league:
                  LeagueHome;
              };
              error: null;
            }>(
              `/leagues/${leagueId}`,
            ),

            authenticatedRequest<{
              success: true;
              data: {
                tournaments:
                  TournamentSummary[];
              };
              error: null;
            }>(
              `/leagues/${leagueId}/tournaments`,
            ),
          ]);

        setUser(
          current,
        );

        setLeague(
          leagueResponse
            .data
            .league,
        );

        setTournaments(
          tournamentResponse
            .data
            .tournaments,
        );
      } catch {
        router.replace(
          '/leagues',
        );
      }
    }

    void load();
  }, [
    leagueId,
    router,
  ]);


  if (
    !user ||
    !league
  ) {
    return (
      <FcLoadingScreen
        label="Loading League Overview..."
      />
    );
  }


  const activeTournaments =
    tournaments.filter(
      (
        tournament,
      ) =>
        ![
          'COMPLETED',
          'CANCELLED',
        ].includes(
          tournament.status,
        ),
    ).length;


  return (
    <AppShell
      playerName={
        user.player
          ?.identity
          ?.inGameName
      }
    >
      <div className="space-y-6">
        <BackHeader
          backHref="/leagues"
          backLabel="My Leagues"
          eyebrow="League Overview"
          title={
            league.name
          }
          subtitle={
            league.region ||
            'FC ARENA League'
          }
          action={
            <div className="flex flex-wrap gap-2">
              <FcStatusBadge
                label={
                  league.membershipType
                }
                tone="cyan"
              />

              {league.adminRole ? (
                <FcStatusBadge
                  label={
                    league.adminRole
                  }
                  tone="amber"
                />
              ) : null}
            </div>
          }
        />

        <LeagueNavigation
          leagueId={
            leagueId
          }
        />


        <FcPanel className="overflow-hidden">
          <div className="bg-[linear-gradient(120deg,rgba(14,165,233,0.08),transparent_65%)] p-5 sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <FcCrest
                  name={
                    league.name
                  }
                  size="lg"
                />

                <div>
                  <p className="font-mono text-xs font-black text-sky-400">
                    {
                      league.code
                    }
                  </p>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                    {league.description ||
                      'No League description has been added yet.'}
                  </p>
                </div>
              </div>

              <Link
                href={
                  `/leagues/${leagueId}/tournaments`
                }
                className="rounded-xl bg-sky-400 px-5 py-3 text-center text-sm font-black text-[#031019]"
              >
                Open Tournaments
              </Link>
            </div>
          </div>
        </FcPanel>


        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <FcStatCard
            label="Members"
            value={
              league.members
            }
            detail={
              `Max ${league.maxMembers}`
            }
          />

          <FcStatCard
            label="Active Tournaments"
            value={
              activeTournaments
            }
            detail={
              `${tournaments.length} total`
            }
            tone="emerald"
          />

          <FcStatCard
            label="Pending Requests"
            value={
              league.pendingApplications
            }
            detail={
              league.adminRole
                ? 'Admin review'
                : 'League applications'
            }
            tone="amber"
          />

          <FcStatCard
            label="Your Role"
            value={
              league.adminRole ||
              'PLAYER'
            }
            detail={
              league.membershipType
            }
            tone="slate"
          />
        </section>


        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[
            [
              'Standings',
              'Tournament tables and rankings',
              `/leagues/${leagueId}/standings`,
              '≣',
            ],
            [
              'Fixtures',
              'All matches from this League',
              `/leagues/${leagueId}/fixtures`,
              '⚽',
            ],
            [
              'Members',
              'Players and member management',
              `/leagues/${leagueId}/members`,
              '◎',
            ],
            [
              'Teams',
              'Tournament teams in this League',
              `/leagues/${leagueId}/teams`,
              '◈',
            ],
            [
              'Settings',
              league.adminRole
                ? 'Applications and League controls'
                : 'Membership and League information',
              `/leagues/${leagueId}/settings`,
              '⚙',
            ],
            [
              'Tournaments',
              'Create and manage competitions',
              `/leagues/${leagueId}/tournaments`,
              '◇',
            ],
          ].map(
            ([
              title,
              description,
              href,
              icon,
            ]) => (
              <Link
                key={
                  title
                }
                href={
                  href
                }
                className="group rounded-[22px] border border-white/10 bg-[#08111b] p-5 transition hover:-translate-y-0.5 hover:border-sky-400/30"
              >
                <span className="grid h-11 w-11 place-items-center rounded-xl border border-sky-400/20 bg-sky-400/[0.06] text-lg text-sky-300">
                  {
                    icon
                  }
                </span>

                <h2 className="mt-4 text-lg font-black">
                  {
                    title
                  }
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {
                    description
                  }
                </p>

                <span className="mt-4 inline-flex text-sm font-black text-sky-300">
                  Open →
                </span>
              </Link>
            ),
          )}
        </section>


        <FcPanel className="p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
            League Owner
          </p>

          <p className="mt-2 font-black">
            {
              league.creator
                .fullName
            }
          </p>

          <p className="mt-1 text-sm text-sky-300">
            {
              league.creator
                .inGameName ||
              'No in-game name'
            }
          </p>
        </FcPanel>
      </div>
    </AppShell>
  );
}
