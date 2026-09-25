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
  FcLoadingScreen,
  FcMenuRow,
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
          leagues
            .data
            .leagues,
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
      <div className="space-y-6">
        <FcPageHeader
          title="More"
          subtitle="Profile, career, community and account tools."
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


        <FcPanel className="p-5">
          <div className="flex items-center gap-4">
            <div className="grid h-11 w-11 place-items-center rounded-xl border border-[#2B3948] bg-[#18212C] text-sm font-semibold text-[#38BDF8]">
              {inGameName
                .slice(
                  0,
                  2,
                )
                .toUpperCase()}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate font-black">
                {
                  inGameName
                }
              </p>

              <p className="mt-1 font-mono text-[10px] text-sky-400">
                {user.player
                  ?.playerCode ||
                  'FC ARENA Player'}
              </p>
            </div>
          </div>
        </FcPanel>


        <section>
          <FcSectionHeading
            eyebrow="Player"
            title="Career & Identity"
          />

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <FcMenuRow
              href="/profile"
              icon="◎"
              title="My Profile"
              description="Player identity and account details"
            />

            <FcMenuRow
              href="/career"
              icon="▥"
              title="Career Stats"
              description="Matches, wins, goals and form"
            />

            <FcMenuRow
              href="/career/matches"
              icon="↺"
              title="Match History"
              description="Verified result history"
              tone="emerald"
            />

            <FcMenuRow
              href="/career/achievements"
              icon="★"
              title="Achievements"
              description="Trophies, awards and milestones"
              tone="amber"
            />
          </div>
        </section>


        <section>
          <FcSectionHeading
            eyebrow="Competition"
            title="Results & Records"
          />

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <FcMenuRow
              href="/matches"
              icon="⚔"
              title="Results"
              description="Match result and verification center"
            />

            <FcMenuRow
              href="/leaderboards"
              icon="≣"
              title="Leaderboards"
              description="League-wide performance across verified Tournaments"
            />

            <FcMenuRow
              href="/awards"
              icon="🏆"
              title="Awards"
              description="Career and Tournament honours"
              tone="amber"
            />

            <FcMenuRow
              href="/match-system"
              icon="⚽"
              title="Match System"
              description="Fixture and match workflow guide"
            />
          </div>
        </section>


        <section>
          <FcSectionHeading
            eyebrow="Community"
            title="People & Activity"
          />

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <FcMenuRow
              href="/community/teams"
              icon="◈"
              title="Teams"
              description="Teams from your current League competitions"
            />

            <FcMenuRow
              href="/community/invitations"
              icon="+"
              title="Invitations & Join Requests"
              description="League membership request access"
            />

            <FcMenuRow
              href="/notifications"
              icon="●"
              title="Notifications"
              description="Competition and system activity"
              badge={
                unread > 0
                  ? unread
                  : undefined
              }
            />

            <FcMenuRow
              href="/announcements"
              icon="⌁"
              title="Announcements"
              description="Community notice area"
              tone="slate"
            />
          </div>
        </section>


        {isAdmin ? (
          <section>
            <FcSectionHeading
              eyebrow="Authorized"
              title="Admin"
            />

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <FcMenuRow
                href="/admin/leagues"
                icon="⚙"
                title="League Management"
                description="Members, applications and League controls"
                tone="amber"
              />

              <FcMenuRow
                href="/admin/tournaments"
                icon="◇"
                title="Tournament Management"
                description="Competition setup and administration"
                tone="amber"
              />

              <FcMenuRow
                href="/admin/teams"
                icon="◎"
                title="Team Management"
                description="Tournament team administration"
                tone="amber"
              />

              <FcMenuRow
                href="/admin/results"
                icon="✓"
                title="Result Verification"
                description="Match results and verification workflow"
                tone="emerald"
              />

              <FcMenuRow
                href="/admin/disputes"
                icon="!"
                title="Disputes"
                description="Match-level dispute access"
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
            <FcMenuRow
              href="/ai"
              icon="✦"
              title="FC ARENA AI"
              description="Read-only help, match context and stats assistant"
              tone="cyan"
            />
            <FcMenuRow
              href="/settings"
              icon="⚙"
              title="Settings"
              description="Account and app preferences"
            />

            <FcMenuRow
              href="/privacy"
              icon="◉"
              title="Privacy"
              description="Privacy and account data information"
            />

            <FcMenuRow
              href="/terms"
              icon="document"
              title="Terms of Service"
              description="Platform use, competition and account terms"
              tone="slate"
            />

            <FcMenuRow
              href="/help"
              icon="?"
              title="Help"
              description="Get help with FC ARENA workflows"
            />

            <FcMenuRow
              href="/about"
              icon="i"
              title="About"
              description="Platform information and version"
              tone="slate"
            />
          </div>


          <button
            type="button"
            disabled={
              loggingOut
            }
            onClick={() =>
              void logout()
            }
            className="theme-danger-button mt-4 min-h-11 w-full rounded-[10px] border px-4 text-sm font-semibold transition disabled:opacity-50"
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
