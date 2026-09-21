'use client';

import {
  useEffect,
  useState,
} from 'react';

import {
  useParams,
  useRouter,
} from 'next/navigation';

import {
  AppShell,
} from '@/components/app/app-shell';

import {
  BackHeader,
} from '@/components/app/back-header';

import {
  FcEmptyState,
  FcErrorState,
  FcLoadingScreen,
  FcPanel,
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

type ScopedRole =
  | 'TOURNAMENT_ADMIN'
  | 'MATCH_OFFICIAL'
  | 'TEAM_MANAGER'
  | 'CAPTAIN'
  | 'PLAYER'
  | 'VIEWER';

interface LeagueHome {
  id: string;
  name: string;
  code: string;
  adminRole:
    | 'OWNER'
    | 'ADMIN'
    | null;
}

interface LeagueMember {
  membershipId: string;
  user: {
    id: string;
    fullName: string;
    playerCode: string | null;
    inGameName: string | null;
    adminRole:
      | 'OWNER'
      | 'ADMIN'
      | null;
  };
}

interface RoleAssignment {
  id: string;
  userId: string;
  role: ScopedRole;
  scopeType: string;
  scopeId: string;
  createdAt: string;

  user: {
    id: string;
    fullName: string;
    email: string;

    player: {
      playerCode: string;
      identity: {
        inGameName: string;
      } | null;
    } | null;
  };

  assignedBy: {
    id: string;
    fullName: string;
  } | null;
}

interface AuditLog {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  createdAt: string;

  actor: {
    id: string;
    fullName: string;

    player: {
      playerCode: string;
      identity: {
        inGameName: string;
      } | null;
    } | null;
  } | null;
}

const roles: Array<{
  value: ScopedRole;
  label: string;
  description: string;
  grantsAdminPower: boolean;
}> = [
  {
    value:
      'TOURNAMENT_ADMIN',
    label:
      'Tournament Admin',
    description:
      'Can manage Tournaments across this League where the existing authorization layer permits it.',
    grantsAdminPower:
      true,
  },
  {
    value:
      'MATCH_OFFICIAL',
    label:
      'Match Admin',
    description:
      'Can manage Fixtures and verify Match Results through the existing Match Official permission.',
    grantsAdminPower:
      true,
  },
  {
    value:
      'TEAM_MANAGER',
    label:
      'Team Manager',
    description:
      'Scoped team identity role. It does not grant Tournament Admin or Result verification permissions.',
    grantsAdminPower:
      false,
  },
  {
    value:
      'CAPTAIN',
    label:
      'Captain',
    description:
      'Scoped competition identity role. It does not grant Admin permissions.',
    grantsAdminPower:
      false,
  },
  {
    value:
      'PLAYER',
    label:
      'Player',
    description:
      'Scoped Player role for access classification. It does not grant Admin permissions.',
    grantsAdminPower:
      false,
  },
  {
    value:
      'VIEWER',
    label:
      'Viewer',
    description:
      'Read-oriented scoped role. It does not grant management permissions.',
    grantsAdminPower:
      false,
  },
];

function roleLabel(
  role: ScopedRole,
) {
  return (
    roles.find(
      (item) =>
        item.value ===
        role,
    )?.label ??
    role
  );
}

function displayName(
  assignment:
    RoleAssignment,
) {
  return (
    assignment.user
      .player?.identity
      ?.inGameName ||
    assignment.user.fullName
  );
}

function auditActor(
  log:
    AuditLog,
) {
  return (
    log.actor?.player
      ?.identity
      ?.inGameName ||
    log.actor?.fullName ||
    'System'
  );
}

function auditLabel(
  action: string,
) {
  if (
    action ===
    'PERMISSION_ASSIGNED'
  ) {
    return 'Role assigned';
  }

  if (
    action ===
    'PERMISSION_REMOVED'
  ) {
    return 'Role removed';
  }

  return action
    .replaceAll(
      '_',
      ' ',
    )
    .toLowerCase()
    .replace(
      /(^|\s)\S/g,
      (letter) =>
        letter.toUpperCase(),
    );
}

export default function LeagueRolesPage() {
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
    members,
    setMembers,
  ] =
    useState<LeagueMember[]>(
      [],
    );

  const [
    assignments,
    setAssignments,
  ] =
    useState<RoleAssignment[]>(
      [],
    );

  const [
    auditLogs,
    setAuditLogs,
  ] =
    useState<AuditLog[]>(
      [],
    );

  const [
    selectedUserId,
    setSelectedUserId,
  ] =
    useState('');

  const [
    selectedRole,
    setSelectedRole,
  ] =
    useState<ScopedRole>(
      'TOURNAMENT_ADMIN',
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState('');

  const [
    message,
    setMessage,
  ] =
    useState('');

  async function loadSecurityData() {
    const [
      rolesResponse,
      auditResponse,
    ] =
      await Promise.all([
        authenticatedRequest<{
          success: true;
          data: {
            assignments:
              RoleAssignment[];
          };
          error: null;
        }>(
          '/security/roles/LEAGUE/' +
            leagueId,
        ),

        authenticatedRequest<{
          success: true;
          data: {
            logs:
              AuditLog[];
          };
          error: null;
        }>(
          '/security/audit/LEAGUE/' +
            leagueId,
        ),
      ]);

    setAssignments(
      rolesResponse.data
        .assignments,
    );

    setAuditLogs(
      auditResponse.data.logs,
    );
  }

  useEffect(() => {
    void (async () => {
      try {
        const [
          current,
          leagueResponse,
          membersResponse,
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
              '/leagues/' +
                leagueId,
            ),

            authenticatedRequest<{
              success: true;
              data: {
                members:
                  LeagueMember[];
              };
              error: null;
            }>(
              '/leagues/' +
                leagueId +
                '/members',
            ),
          ]);

        const currentLeague =
          leagueResponse.data
            .league;

        if (
          !currentLeague
            .adminRole
        ) {
          router.replace(
            '/leagues/' +
              leagueId,
          );

          return;
        }

        setUser(
          current,
        );

        setLeague(
          currentLeague,
        );

        setMembers(
          membersResponse.data
            .members,
        );

        setSelectedUserId(
          membersResponse.data
            .members.find(
              (member) =>
                member.user
                  .adminRole !==
                'OWNER',
            )?.user.id ||
            '',
        );

        await loadSecurityData();
      } catch {
        router.replace(
          '/leagues/' +
            leagueId,
        );
      } finally {
        setLoading(
          false,
        );
      }
    })();
  }, [
    leagueId,
    router,
  ]);

  async function assignRole() {
    if (
      !selectedUserId ||
      busy
    ) {
      return;
    }

    setBusy(
      true,
    );

    setError('');
    setMessage('');

    try {
      const response =
        await authenticatedRequest<{
          success: true;
          data: {
            message:
              string;
          };
          error: null;
        }>(
          '/security/roles',
          {
            method:
              'POST',

            body:
              JSON.stringify({
                userId:
                  selectedUserId,
                role:
                  selectedRole,
                scopeType:
                  'LEAGUE',
                scopeId:
                  leagueId,
              }),
          },
        );

      setMessage(
        response.data.message,
      );

      await loadSecurityData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to assign role.',
      );
    } finally {
      setBusy(
        false,
      );
    }
  }

  async function removeRole(
    assignment:
      RoleAssignment,
  ) {
    if (
      busy ||
      !window.confirm(
        'Remove ' +
          roleLabel(
            assignment.role,
          ) +
          ' from ' +
          displayName(
            assignment,
          ) +
          '?',
      )
    ) {
      return;
    }

    setBusy(
      true,
    );

    setError('');
    setMessage('');

    try {
      const response =
        await authenticatedRequest<{
          success: true;
          data: {
            message:
              string;
          };
          error: null;
        }>(
          '/security/roles/' +
            assignment.id,
          {
            method:
              'DELETE',
          },
        );

      setMessage(
        response.data.message,
      );

      await loadSecurityData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to remove role.',
      );
    } finally {
      setBusy(
        false,
      );
    }
  }

  if (
    loading ||
    !user ||
    !league
  ) {
    return (
      <FcLoadingScreen
        label="Loading Roles & Audit..."
      />
    );
  }

  const selectedRoleInfo =
    roles.find(
      (item) =>
        item.value ===
        selectedRole,
    );

  const assignableMembers =
    members.filter(
      (member) =>
        member.user
          .adminRole !==
        'OWNER',
    );

  return (
    <AppShell
      playerName={
        user.player
          ?.identity
          ?.inGameName ||
        user.fullName
      }
    >
      <div className="space-y-6">
        <BackHeader
          backHref={
            '/leagues/' +
            leagueId +
            '/settings'
          }
          backLabel="League Settings"
          eyebrow={
            league.name
          }
          title="Roles & Audit"
          subtitle="Manage scoped League responsibilities using FC ARENA's existing backend-enforced permission system."
        />

        <LeagueNavigation
          leagueId={
            leagueId
          }
        />

        {message ? (
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4 text-sm text-emerald-300">
            {
              message
            }
          </div>
        ) : null}

        {error ? (
          <FcErrorState
            message={
              error
            }
          />
        ) : null}

        <FcPanel className="p-5 sm:p-6">
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">
              Permission Assignment
            </p>

            <h2 className="theme-text text-xl font-black">
              Assign a League Role
            </h2>

            <p className="theme-secondary-text max-w-3xl text-sm leading-6">
              Tournament Admin and Match Admin carry real management permissions. Team Manager, Captain, Player and Viewer remain scoped identity roles unless additional permissions are explicitly implemented later.
            </p>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <label className="grid gap-2">
              <span className="theme-muted text-xs font-bold uppercase tracking-[0.12em]">
                Member
              </span>

              <select
                value={
                  selectedUserId
                }
                onChange={(
                  event,
                ) =>
                  setSelectedUserId(
                    event.target.value,
                  )
                }
                className="theme-input min-h-12 rounded-xl border px-3 text-sm"
              >
                {assignableMembers.length ===
                0 ? (
                  <option value="">
                    No assignable members
                  </option>
                ) : (
                  assignableMembers.map(
                    (
                      member,
                    ) => (
                      <option
                        key={
                          member.user.id
                        }
                        value={
                          member.user.id
                        }
                      >
                        {member.user
                          .inGameName ||
                          member.user
                            .fullName}
                        {' — '}
                        {
                          member.user
                            .fullName
                        }
                      </option>
                    ),
                  )
                )}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="theme-muted text-xs font-bold uppercase tracking-[0.12em]">
                Role
              </span>

              <select
                value={
                  selectedRole
                }
                onChange={(
                  event,
                ) =>
                  setSelectedRole(
                    event.target
                      .value as ScopedRole,
                  )
                }
                className="theme-input min-h-12 rounded-xl border px-3 text-sm"
              >
                {roles.map(
                  (
                    role,
                  ) => (
                    <option
                      key={
                        role.value
                      }
                      value={
                        role.value
                      }
                    >
                      {
                        role.label
                      }
                    </option>
                  ),
                )}
              </select>
            </label>
          </div>

          {selectedRoleInfo ? (
            <div className="mt-4 rounded-xl border border-white/10 bg-black/10 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <FcStatusBadge
                  label={
                    selectedRoleInfo.label
                  }
                  tone={
                    selectedRoleInfo
                      .grantsAdminPower
                      ? 'amber'
                      : 'slate'
                  }
                />

                <FcStatusBadge
                  label={
                    selectedRoleInfo
                      .grantsAdminPower
                      ? 'Management permission'
                      : 'Scoped identity role'
                  }
                  tone={
                    selectedRoleInfo
                      .grantsAdminPower
                      ? 'emerald'
                      : 'cyan'
                  }
                />
              </div>

              <p className="theme-secondary-text mt-3 text-sm leading-6">
                {
                  selectedRoleInfo.description
                }
              </p>
            </div>
          ) : null}

          <button
            type="button"
            disabled={
              busy ||
              !selectedUserId
            }
            onClick={() =>
              void assignRole()
            }
            className="theme-primary-button mt-5 min-h-12 rounded-xl px-5 text-sm font-black disabled:opacity-40"
          >
            {busy
              ? 'Saving...'
              : 'Assign Role'}
          </button>
        </FcPanel>

        <section>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">
                Active Access
              </p>

              <h2 className="mt-1 text-xl font-black">
                Scoped Role Assignments
              </h2>
            </div>

            <FcStatusBadge
              label={
                assignments.length +
                ' Assigned'
              }
              tone="cyan"
            />
          </div>

          {assignments.length >
          0 ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {assignments.map(
                (
                  assignment,
                ) => {
                  const info =
                    roles.find(
                      (
                        role,
                      ) =>
                        role.value ===
                        assignment.role,
                    );

                  return (
                    <FcPanel
                      key={
                        assignment.id
                      }
                      className="p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap gap-2">
                            <FcStatusBadge
                              label={
                                roleLabel(
                                  assignment.role,
                                )
                              }
                              tone={
                                info
                                  ?.grantsAdminPower
                                  ? 'amber'
                                  : 'slate'
                              }
                            />
                          </div>

                          <h3 className="theme-text mt-4 truncate text-lg font-black">
                            {
                              displayName(
                                assignment,
                              )
                            }
                          </h3>

                          <p className="theme-secondary-text mt-1 text-sm">
                            {
                              assignment.user
                                .fullName
                            }
                          </p>

                          <p className="theme-muted mt-3 text-xs">
                            Assigned by{' '}
                            {assignment
                              .assignedBy
                              ?.fullName ||
                              'System'}
                            {' • '}
                            {new Date(
                              assignment.createdAt,
                            ).toLocaleString()}
                          </p>
                        </div>

                        <button
                          type="button"
                          disabled={
                            busy
                          }
                          onClick={() =>
                            void removeRole(
                              assignment,
                            )
                          }
                          className="shrink-0 rounded-xl border border-red-400/20 px-3 py-2 text-xs font-black text-red-300 disabled:opacity-40"
                        >
                          Remove
                        </button>
                      </div>
                    </FcPanel>
                  );
                },
              )}
            </div>
          ) : (
            <FcEmptyState
              title="No scoped roles"
              description="No additional League-scoped roles have been assigned yet."
            />
          )}
        </section>

        <section>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">
                Security Audit
              </p>

              <h2 className="mt-1 text-xl font-black">
                Recent League Actions
              </h2>
            </div>

            <FcStatusBadge
              label={
                auditLogs.length +
                ' Events'
              }
              tone="slate"
            />
          </div>

          {auditLogs.length >
          0 ? (
            <FcPanel className="overflow-hidden">
              <div className="divide-y divide-white/[0.06]">
                {auditLogs.map(
                  (
                    log,
                  ) => (
                    <div
                      key={
                        log.id
                      }
                      className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
                    >
                      <div>
                        <p className="theme-text font-bold">
                          {
                            auditLabel(
                              log.action,
                            )
                          }
                        </p>

                        <p className="theme-secondary-text mt-1 text-sm">
                          By{' '}
                          {
                            auditActor(
                              log,
                            )
                          }
                          {' • '}
                          {
                            log.targetType
                          }
                        </p>
                      </div>

                      <p className="theme-muted text-xs">
                        {new Date(
                          log.createdAt,
                        ).toLocaleString()}
                      </p>
                    </div>
                  ),
                )}
              </div>
            </FcPanel>
          ) : (
            <FcEmptyState
              title="No audit events yet"
              description="Role and permission changes for this League will appear here."
            />
          )}
        </section>
      </div>
    </AppShell>
  );
}
