'use client';

import Link from 'next/link';
import {
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
  FixtureGeneratorShell,
} from '@/components/fixtures/fixture-generator-shell';

import {
  FcLoadingScreen,
  FcPanel,
  FcStatusBadge,
} from '@/components/fc/fc-ui';

import {
  authenticatedRequest,
  getCurrentUser,
  type CurrentUser,
} from '@/lib/auth-client';

import {
  clearFixtureGeneratorDraft,
  expectedRoundRobinCounts,
  loadFixtureGeneratorDraft,
  type FixtureGeneratorDraft,
} from '@/lib/fixture-generator-draft';


interface PreviewFixture {
  id: string;
  roundNumber: number;
  group: {
    id: string;
    name: string;
  } | null;
}


export default function FixtureSavePage() {
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
    draft,
  ] =
    useState<FixtureGeneratorDraft>(
      () =>
        loadFixtureGeneratorDraft(),
    );

  const [
    fixtures,
    setFixtures,
  ] =
    useState<PreviewFixture[]>(
      [],
    );

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
    saved,
    setSaved,
  ] =
    useState(false);


  useEffect(() => {
    if (
      !draft.tournamentId ||
      draft.selectedRegistrationIds.length <
        2
    ) {
      router.replace(
        '/fixtures/generate',
      );

      return;
    }

    void (async () => {
      try {
        const [
          current,
          response,
        ] =
          await Promise.all([
            getCurrentUser(),

            authenticatedRequest<any>(
              `/tournaments/${draft.tournamentId}/wizard/fixture-preview`,
            ),
          ]);

        setUser(
          current,
        );

        const all:
          PreviewFixture[] =
          response
            .data
            .fixtures;

        setFixtures(
          draft.scope ===
            'GROUP' &&
          draft.groupId
            ? all.filter(
                (
                  fixture,
                ) =>
                  fixture.group?.id ===
                  draft.groupId,
              )
            : all,
        );
      } catch (
        err
      ) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load fixture summary.',
        );
      }
    })();
  }, [
    draft.groupId,
    draft.scope,
    draft.tournamentId,
    router,
  ]);


  async function save() {
    if (
      fixtures.length ===
      0
    ) {
      setError(
        'There are no draft fixtures to save.',
      );

      return;
    }

    setBusy(
      true,
    );

    setError(
      '',
    );

    try {
      await authenticatedRequest(
        `/tournaments/${draft.tournamentId}/wizard/fixture-preview/publish`,
        {
          method:
            'POST',

          body:
            JSON.stringify({
              registrationIds:
                draft.selectedRegistrationIds,

              ...(draft.scope ===
                'GROUP' &&
              draft.groupId
                ? {
                    groupId:
                      draft.groupId,
                  }
                : {}),
            }),
        },
      );

      setSaved(
        true,
      );

      clearFixtureGeneratorDraft();
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save fixtures.',
      );
    } finally {
      setBusy(
        false,
      );
    }
  }


  if (!user) {
    return (
      <FcLoadingScreen
        label="Loading Fixture Summary..."
      />
    );
  }


  const counts =
    expectedRoundRobinCounts(
      draft.participantCount,
      draft.meetings,
    );


  if (
    saved
  ) {
    return (
      <AppShell
        playerName={
          user.player
            ?.identity
            ?.inGameName
        }
      >
        <FixtureGeneratorShell
          step="SAVE"
          title="Fixtures Saved"
          description="The approved fixture preview is now stored in FC ARENA and connected to the existing Match system."
        >
          <FcPanel className="p-6 text-center sm:p-8">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-300">
              ✓
            </div>

            <h2 className="mt-4 text-xl font-semibold">
              Fixture list saved successfully
            </h2>

            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#A7B0BE]">
              {draft.fixtureListName} is ready. Match Details, result submission, verification and standings continue to use the existing FC ARENA workflow.
            </p>

            <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
              <Link
                href={
                  `/tournaments/${draft.tournamentId}/fixtures`
                }
                className="inline-flex min-h-11 items-center justify-center rounded-[10px] bg-[#38BDF8] px-5 text-sm font-semibold text-[#071018] hover:bg-[#0EA5E9]"
              >
                Open Generated Fixtures
              </Link>

              <Link
                href="/fixtures"
                className="inline-flex min-h-11 items-center justify-center rounded-[10px] border border-[#253140] bg-[#151C26] px-5 text-sm font-medium text-[#F8FAFC]"
              >
                Back to Fixtures
              </Link>
            </div>
          </FcPanel>
        </FixtureGeneratorShell>
      </AppShell>
    );
  }


  return (
    <AppShell
      playerName={
        user.player
          ?.identity
          ?.inGameName
      }
    >
      <FixtureGeneratorShell
        step="SAVE"
        title="Save Fixtures"
        description="Final validation runs before fixtures become official. Existing Match and result workflows are preserved."
      >
        {error ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.05] p-4 text-sm text-red-300">
            {
              error
            }
          </div>
        ) : null}


        <FcPanel className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs text-[#6F7B8A]">
                Fixture List
              </p>

              <h2 className="mt-1 text-xl font-semibold">
                {
                  draft.fixtureListName
                }
              </h2>
            </div>

            <FcStatusBadge
              label={
                draft.scope ===
                'GROUP'
                  ? 'Group Scope'
                  : 'Tournament Scope'
              }
              tone="cyan"
            />
          </div>


          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-[#253140] bg-[#151C26] p-4">
              <p className="text-xs text-[#6F7B8A]">
                Participants
              </p>

              <p className="mt-1 text-lg font-semibold">
                {
                  draft.participantCount
                }
              </p>
            </div>

            <div className="rounded-xl border border-[#253140] bg-[#151C26] p-4">
              <p className="text-xs text-[#6F7B8A]">
                Meetings
              </p>

              <p className="mt-1 text-sm font-semibold">
                {draft.meetings ===
                'HOME_AWAY'
                  ? 'Home & Away'
                  : 'Single Round'}
              </p>
            </div>

            <div className="rounded-xl border border-[#253140] bg-[#151C26] p-4">
              <p className="text-xs text-[#6F7B8A]">
                Draft Matches
              </p>

              <p className="mt-1 text-lg font-semibold">
                {
                  fixtures.length
                }
              </p>
            </div>

            <div className="rounded-xl border border-[#253140] bg-[#151C26] p-4">
              <p className="text-xs text-[#6F7B8A]">
                Expected
              </p>

              <p className="mt-1 text-lg font-semibold">
                {draft.method ===
                'MANUAL'
                  ? 'Manual'
                  : counts.matches}
              </p>
            </div>
          </div>


          <div className="mt-6 space-y-2 border-t border-[#253140] pt-5 text-sm text-[#A7B0BE]">
            <p>
              ✓ No participant may play itself.
            </p>

            <p>
              ✓ A participant cannot play twice in the same Matchday.
            </p>

            <p>
              ✓ Duplicate pairings are validated against Single Round / Home & Away rules.
            </p>

            {draft.method !==
            'MANUAL' ? (
              <p>
                ✓ Every selected participant must meet every other selected participant the required number of times.
              </p>
            ) : null}
          </div>
        </FcPanel>


        <div className="flex items-center justify-between border-t border-[#253140] pt-5">
          <button
            type="button"
            onClick={() =>
              router.push(
                '/fixtures/generate/preview',
              )
            }
            className="min-h-11 rounded-[10px] px-4 text-sm font-medium text-[#A7B0BE] hover:bg-[#151C26]"
          >
            ← Back to Preview
          </button>

          <button
            type="button"
            disabled={
              busy ||
              fixtures.length ===
                0
            }
            onClick={() =>
              void save()
            }
            className="min-h-11 rounded-[10px] bg-[#22C55E] px-5 text-sm font-semibold text-[#071018] hover:bg-emerald-500 disabled:opacity-40"
          >
            {busy
              ? 'Validating & Saving...'
              : 'Save Fixtures'}
          </button>
        </div>
      </FixtureGeneratorShell>
    </AppShell>
  );
}
