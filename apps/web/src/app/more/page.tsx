'use client';

import {
  useRouter,
} from 'next/navigation';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  AppShell,
} from '@/components/app/app-shell';

import {
  FcActionRow,
  FcLoadingScreen,
  FcPageHeader,
  FcPanel,
  FcSectionHeading,
  FcStatusBadge,
} from '@/components/fc/fc-ui';

import {
  authenticatedRequest,
  type CurrentUser,
  getCurrentUser,
  logoutCurrentUser,
} from '@/lib/auth-client';


interface Membership {
  adminRole:
    | 'OWNER'
    | 'ADMIN'
    | null;

  league: {
    id: string;
    name: string;
  };
}


interface NotificationData {
  unreadCount: number;
}


export default function MorePage() {
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
    memberships,
    setMemberships,
  ] =
    useState<Membership[]>(
      [],
    );

  const [
    unread,
    setUnread,
  ] =
    useState(
      0,
    );

  const [
    infoPanel,
    setInfoPanel,
  ] =
    useState<
      'ABOUT'
      | 'HELP'
      | null
    >(
      null,
    );

  const [
    loggingOut,
    setLoggingOut,
  ] =
    useState(false);


  useEffect(() => {
    void (async () => {
      try {
        const [
          current,
          leagues,
          notifications,
        ] =
          await Promise.all([
            getCurrentUser(),

            authenticatedRequest<{
              data: {
                leagues:
                  Membership[];
              };
            }>(
              '/leagues/my',
            ),

            authenticatedRequest<{
              success: true;
              data:
                NotificationData;
              error: null;
            }>(
              '/notifications',
            ).catch(
              () => ({
                success:
                  true as const,

                data: {
                  unreadCount:
                    0,
                },

                error:
                  null,
              }),
            ),
          ]);

        setUser(
          current,
        );

        setMemberships(
          leagues.data.leagues,
        );

        setUnread(
          notifications
            .data
            .unreadCount,
        );
      } catch {
        router.replace(
          '/login',
        );
      }
    })();
  }, [
    router,
  ]);


  const isAdmin =
    useMemo(
      () =>
        memberships.some(
          (
            membership,
          ) =>
            Boolean(
              membership.adminRole,
            ),
        ),
      [
        memberships,
      ],
    );


  async function logout() {
    if (
      loggingOut
    ) {
      return;
    }

    setLoggingOut(
      true,
    );

    try {
      await logoutCurrentUser();

      router.replace(
        '/login',
      );

      router.refresh();
    } finally {
      setLoggingOut(
        false,
      );
    }
  }


  if (!user) {
    return (
      <FcLoadingScreen
        label="Loading More..."
      />
    );
  }


  const inGameName =
    user.player
      ?.identity
      ?.inGameName ||
    user.fullName;


  return (
    <AppShell
      playerName={
        inGameName
      }
    >
      <div className="space-y-7">
        <FcPageHeader
          eyebrow="Secondary Hub"
          title="More"
          subtitle="Profile, career, competition records, community tools and account controls — organized without duplicating the five primary sections."
          action={
            <FcStatusBadge
              label={
                isAdmin
                  ? 'Admin Access'
                  : 'Player Access'
              }
              tone={
                isAdmin
                  ? 'amber'
                  : 'cyan'
              }
            />
          }
        />


        <FcPanel className="p-5 sm:p-6">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-2xl border border-sky-400/20 bg-sky-400/[0.07] text-lg font-black text-sky-300">
              {inGameName
                .slice(
                  0,
                  2,
                )
                .toUpperCase()}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-xl font-black">
                {
                  inGameName
                }
              </p>

              <p className="mt-1 font-mono text-xs text-sky-400">
                {user.player
                  ?.playerCode ||
                  'FC ARENA Player'}
              </p>
            </div>

            <FcStatusBadge
              label={
                user.status
              }
              tone="emerald"
            />
          </div>
        </FcPanel>


        <section>
          <FcSectionHeading
            eyebrow="Player"
            title="Career & Identity"
          />

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <FcActionRow
              href="/profile"
              icon="◎"
              title="My Profile"
              description="Player identity, FC ARENA ID and account information"
            />

            <FcActionRow
              href="/career"
              icon="▥"
              title="Career Stats"
              description="Matches, wins, goals, form and competition history"
            />

            <FcActionRow
              href="/career"
              icon="↺"
              title="Match History"
              description="Verified result history and performance record"
              tone="emerald"
            />

            <FcActionRow
              href="/career"
              icon="★"
              title="Trophies & Achievements"
              description="Tournament awards, milestones and career honours"
              tone="amber"
            />
          </div>
        </section>


        <section>
          <FcSectionHeading
            eyebrow="Competition"
            title="Records & Results"
          />

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <FcActionRow
              href="/matches"
              icon="⚔"
              title="Results & Match Center"
              description="Open matches, result submission and verification"
            />

            <FcActionRow
              href="/tournaments"
              icon="≣"
              title="Standings"
              description="Open a Tournament to view its live standings"
            />

            <FcActionRow
              href="/career"
              icon="🏆"
              title="Awards"
              description="Career achievements and tournament honours"
              tone="amber"
            />

            <FcActionRow
              href="/fixtures"
              icon="⚽"
              title="Match System"
              description="Fixtures, schedules, matchdays and knockout rounds"
            />
          </div>
        </section>


        <section>
          <FcSectionHeading
            eyebrow="Community"
            title="People & Activity"
          />

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <FcActionRow
              href="/leagues"
              icon="◈"
              title="Teams & Members"
              description="League communities, members and competition access"
            />

            <FcActionRow
              href="/leagues"
              icon="+"
              title="Invitations & Join Requests"
              description="League-code joining and pending membership requests"
            />

            <FcActionRow
              href="/notifications"
              icon="●"
              title="Notifications"
              description="Competition alerts, results and system activity"
              badge={
                unread >
                0
                  ? unread
                  : undefined
              }
            />

            <FcActionRow
              href="/leagues"
              icon="⌁"
              title="Announcements"
              description="League and competition information from your communities"
              tone="slate"
            />
          </div>
        </section>


        {isAdmin ? (
          <section>
            <FcSectionHeading
              eyebrow="Authorized"
              title="Admin & Management"
            />

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <FcActionRow
                href="/leagues"
                icon="⚙"
                title="League Management"
                description="Members, applications and League competition controls"
                tone="amber"
              />

              <FcActionRow
                href="/tournaments"
                icon="◇"
                title="Tournament Management"
                description="Create and manage Tournament structures and rules"
                tone="amber"
              />

              <FcActionRow
                href="/matches"
                icon="✓"
                title="Result Verification"
                description="Review submitted results in the existing Match Center"
                tone="emerald"
              />

              <FcActionRow
                href="/fixtures"
                icon="!"
                title="Fixtures & Disputes"
                description="Schedule controls and match-level administration"
                tone="red"
              />
            </div>
          </section>
        ) : null}


        <section>
          <FcSectionHeading
            eyebrow="Account"
            title="App & Support"
          />

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <FcActionRow
              href="/profile"
              icon="✎"
              title="Edit Profile"
              description="Review and maintain your player identity"
            />

            <FcActionRow
              href="/notifications"
              icon="◉"
              title="Notification Settings"
              description="Open notification center and activity controls"
            />

            <button
              type="button"
              onClick={() =>
                setInfoPanel(
                  infoPanel ===
                  'HELP'
                    ? null
                    : 'HELP',
                )
              }
              className="flex items-center gap-4 rounded-2xl border border-white/10 bg-[#0a1520] p-4 text-left transition hover:border-sky-400/30"
            >
              <span className="grid h-11 w-11 place-items-center rounded-xl border border-sky-400/20 bg-sky-400/[0.06] text-lg text-sky-300">
                ?
              </span>

              <span className="min-w-0 flex-1">
                <span className="block font-black">
                  Help & Support
                </span>

                <span className="mt-0.5 block text-xs leading-5 text-slate-600">
                  Get guidance for account and competition issues
                </span>
              </span>

              <span className="text-slate-700">
                ›
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                setInfoPanel(
                  infoPanel ===
                  'ABOUT'
                    ? null
                    : 'ABOUT',
                )
              }
              className="flex items-center gap-4 rounded-2xl border border-white/10 bg-[#0a1520] p-4 text-left transition hover:border-sky-400/30"
            >
              <span className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/[0.035] text-lg text-slate-300">
                i
              </span>

              <span className="min-w-0 flex-1">
                <span className="block font-black">
                  About FC ARENA
                </span>

                <span className="mt-0.5 block text-xs leading-5 text-slate-600">
                  Platform information, version and competition philosophy
                </span>
              </span>

              <span className="text-slate-700">
                ›
              </span>
            </button>
          </div>


          {infoPanel ===
          'HELP' ? (
            <FcPanel className="mt-3 p-5">
              <p className="font-black text-sky-300">
                Help & Support
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                For competition issues, open the relevant League, Tournament or Match page so the existing admin and verification tools have the correct context. Account identity details are available from My Profile.
              </p>
            </FcPanel>
          ) : null}


          {infoPanel ===
          'ABOUT' ? (
            <FcPanel className="mt-3 p-5">
              <p className="font-black text-sky-300">
                FC ARENA
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                A football competition community platform for Leagues, Tournaments, Fixtures, verified results and player career history.
              </p>

              <p className="mt-3 font-mono text-xs text-slate-600">
                App Version 1.0.0
              </p>
            </FcPanel>
          ) : null}


          <button
            type="button"
            disabled={
              loggingOut
            }
            onClick={() =>
              void logout()
            }
            className="mt-4 w-full rounded-2xl border border-red-400/25 bg-red-400/[0.04] px-5 py-4 text-sm font-black uppercase tracking-[0.12em] text-red-300 transition hover:bg-red-400/[0.08] disabled:opacity-50"
          >
            {loggingOut
              ? 'Signing Out...'
              : 'Logout'}
          </button>
        </section>
      </div>
    </AppShell>
  );
}
