'use client';

/* eslint-disable react-hooks/exhaustive-deps -- Data-loading effects are intentionally keyed by resource identifiers; loader callback identity must not retrigger network work. */

import { confirmAction } from '@/components/fc/confirmation-provider';
import { FcNotice } from '@/components/fc/fc-ui';
import {
  useParams,
  useRouter,
} from 'next/navigation';
import type {
  FormEvent,
} from 'react';
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
  adminRole:
    | 'OWNER'
    | 'ADMIN'
    | null;
}


interface LeagueMember {
  membershipId: string;
  membershipType:
    | 'PRIMARY'
    | 'SECONDARY';
  joinedAt: string;

  user: {
    id: string;
    fullName: string;
    playerCode: string | null;
    profileImageUrl?: string | null;
    inGameName: string | null;
    identityVerified: boolean;

    adminRole:
      | 'OWNER'
      | 'ADMIN'
      | null;
  };
}


export default function LeagueMembersPage() {
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
    search,
    setSearch,
  ] =
    useState('');

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


  async function loadMembers(
    value = '',
  ) {
    const query =
      value
        ? `?search=${encodeURIComponent(value)}`
        : '';

    const response =
      await authenticatedRequest<{
        success: true;
        data: {
          members:
            LeagueMember[];
        };
        error: null;
      }>(
        `/leagues/${leagueId}/members${query}`,
      );

    setMembers(
      response.data.members,
    );
  }


  useEffect(() => {
    async function load() {
      try {
        const [
          current,
          leagueResponse,
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
          ]);

        setUser(
          current,
        );

        setLeague(
          leagueResponse
            .data
            .league,
        );

        await loadMembers();
      } catch {
        router.replace(
          `/leagues/${leagueId}`,
        );
      }
    }

    void load();
  }, [
    leagueId,
    router,
  ]);


  async function searchMembers(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError(
      '',
    );

    try {
      await loadMembers(
        search,
      );
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to search members.',
      );
    }
  }


  async function removeMember(
    member:
      LeagueMember,
  ) {
    if (
      !(await confirmAction(
        { title: 'Remove league member?', description: `Remove “${member.user.inGameName || member.user.fullName}” from this league? Their league membership will be removed.`, confirmLabel: 'Remove member', destructive: true },
      ))
    ) {
      return;
    }

    setBusy(
      true,
    );

    setError(
      '',
    );

    setMessage(
      '',
    );

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
          `/leagues/${leagueId}/members/${member.user.id}`,
          {
            method:
              'DELETE',
          },
        );

      setMessage(
        response.data.message,
      );

      await loadMembers(
        search,
      );
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to remove member.',
      );
    } finally {
      setBusy(
        false,
      );
    }
  }


  if (
    !user ||
    !league
  ) {
    return (
      <FcLoadingScreen
        label="Loading League Members..."
      />
    );
  }


  const isAdmin =
    Boolean(
      league.adminRole,
    );


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
          backHref={
            `/leagues/${leagueId}`
          }
          backLabel="League Overview"
          eyebrow={
            league.name
          }
          title="Members"
          subtitle="Players in this League. Admin member controls stay on this focused screen."
        />

        <LeagueNavigation
          leagueId={
            leagueId
          }
        />


        <FcNotice>{message}</FcNotice>
        <FcNotice tone="error">{error}</FcNotice>


        <form onSubmit={searchMembers} className="fc-directory-search" role="search" aria-label="Find league members">
          <input type="search" value={search} onChange={event => setSearch(event.target.value)}
            placeholder="Name or Player ID" aria-label="Search league members" className="theme-input" />
          <button type="submit" className="theme-secondary-button">Search</button>
        </form>

        {members.length > 0 && <ul className="fc-directory" aria-label="League members">
          {members.map(member => {
            const { user: player } = member;
            const name = player.inGameName || player.fullName;
            const canRemove = isAdmin && player.adminRole !== 'OWNER' && player.id !== user.id;
            return <li key={member.membershipId}>
              <div className="fc-directory-row">
                <span aria-hidden="true"><FcCrest name={name} imageUrl={player.profileImageUrl} size="sm" /></span>
                <div className="fc-directory-identity">
                  <h2>{name}</h2>
                  <p>{player.fullName !== name && <>{player.fullName} · </>}{player.playerCode || 'Player ID pending'}<span className="fc-directory-inline-date"> · {new Date(member.joinedAt).toLocaleDateString()}</span></p>
                  <div className="fc-directory-tags">
                    <FcStatusBadge label={member.membershipType === 'PRIMARY' ? 'Primary' : 'Secondary'} tone="cyan" />
                    {player.adminRole && <FcStatusBadge label={player.adminRole === 'OWNER' ? 'Owner' : 'Admin'} tone="amber" />}
                    {player.identityVerified && <FcStatusBadge label="Verified" tone="emerald" />}
                  </div>
                </div>
                <time dateTime={member.joinedAt} className="fc-directory-date">Joined {new Date(member.joinedAt).toLocaleDateString()}</time>
                {canRemove && <button type="button" disabled={busy} className="fc-member-remove theme-danger"
                  aria-label={'Remove ' + name} onClick={() => void removeMember(member)}>Remove</button>}
              </div>
            </li>;
          })}
        </ul>}

        {members.length ===
        0 ? (
          <FcPanel className="border-dashed p-10 text-center text-sm text-slate-500">
            No matching League members.
          </FcPanel>
        ) : null}
      </div>
    </AppShell>
  );
}
