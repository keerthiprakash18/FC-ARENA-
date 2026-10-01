'use client';

import {
  FormEvent,
  useEffect,
  useState,
} from 'react';

import {
  AdminNavigation,
} from '@/components/admin/admin-navigation';

import {
  FcEmptyState,
  FcPanel,
  FcStatusBadge,
} from '@/components/fc/fc-ui';

import {
  SecondaryFeaturePage,
} from '@/components/fc/secondary-feature-page';

import {
  authenticatedRequest,
} from '@/lib/auth-client';

interface AndroidRelease {
  id: string;
  versionCode: number;
  versionName: string;
  channel:
    | 'INTERNAL'
    | 'CLOSED'
    | 'PRODUCTION';
  status:
    | 'DRAFT'
    | 'READY'
    | 'PUBLISHED'
    | 'SUPERSEDED';
  minimumSupportedVersionCode:
    number | null;
  forceUpdateBelowVersionCode:
    number | null;
  releaseNotes:
    string | null;
  playStoreUrl:
    string | null;
  sourceCommit:
    string | null;
  artifactSha256:
    string | null;
  publishedAt:
    string | null;
  createdAt:
    string;

  createdBy: {
    id: string;
    name: string;
  };
}

function statusTone(
  status:
    AndroidRelease[
      'status'
    ],
) {
  if (
    status ===
    'PUBLISHED'
  ) {
    return 'emerald' as const;
  }

  if (
    status ===
    'READY'
  ) {
    return 'cyan' as const;
  }

  if (
    status ===
    'SUPERSEDED'
  ) {
    return 'slate' as const;
  }

  return 'amber' as const;
}

export default function AdminAndroidReleasesPage() {
  const [
    releases,
    setReleases,
  ] =
    useState<AndroidRelease[]>(
      [],
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

  const [
    versionCode,
    setVersionCode,
  ] =
    useState('');

  const [
    versionName,
    setVersionName,
  ] =
    useState('');

  const [
    channel,
    setChannel,
  ] =
    useState<
      AndroidRelease[
        'channel'
      ]
    >(
      'INTERNAL',
    );

  const [
    minimumSupported,
    setMinimumSupported,
  ] =
    useState('');

  const [
    forceBelow,
    setForceBelow,
  ] =
    useState('');

  const [
    releaseNotes,
    setReleaseNotes,
  ] =
    useState('');

  const [
    playStoreUrl,
    setPlayStoreUrl,
  ] =
    useState(
      'https://play.google.com/store/apps/details?id=in.fcarena.app',
    );

  const [
    sourceCommit,
    setSourceCommit,
  ] =
    useState('');

  const [
    artifactSha256,
    setArtifactSha256,
  ] =
    useState('');

  async function load() {
    try {
      const response =
        await authenticatedRequest<{
          success: true;

          data: {
            releases:
              AndroidRelease[];
          };

          error: null;
        }>(
          '/admin/ops/android/releases',
        );

      setReleases(
        response.data
          .releases,
      );

      setError(
        '',
      );
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load Android releases.',
      );
    } finally {
      setLoading(
        false,
      );
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createRelease(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      busy
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
      await authenticatedRequest(
        '/admin/ops/android/releases',
        {
          method:
            'POST',

          body:
            JSON.stringify({
              versionCode:
                Number(
                  versionCode,
                ),
              versionName:
                versionName
                  .trim(),
              channel,

              ...(
                minimumSupported
                  ? {
                      minimumSupportedVersionCode:
                        Number(
                          minimumSupported,
                        ),
                    }
                  : {}
              ),

              ...(
                forceBelow
                  ? {
                      forceUpdateBelowVersionCode:
                        Number(
                          forceBelow,
                        ),
                    }
                  : {}
              ),

              ...(
                releaseNotes
                  .trim()
                  ? {
                      releaseNotes:
                        releaseNotes
                          .trim(),
                    }
                  : {}
              ),

              ...(
                playStoreUrl
                  .trim()
                  ? {
                      playStoreUrl:
                        playStoreUrl
                          .trim(),
                    }
                  : {}
              ),

              ...(
                sourceCommit
                  .trim()
                  ? {
                      sourceCommit:
                        sourceCommit
                          .trim(),
                    }
                  : {}
              ),

              ...(
                artifactSha256
                  .trim()
                  ? {
                      artifactSha256:
                        artifactSha256
                          .trim(),
                    }
                  : {}
              ),
            }),
        },
      );

      setMessage(
        'Android release record created as DRAFT.',
      );

      setVersionCode(
        '',
      );
      setVersionName(
        '',
      );
      setMinimumSupported(
        '',
      );
      setForceBelow(
        '',
      );
      setReleaseNotes(
        '',
      );
      setSourceCommit(
        '',
      );
      setArtifactSha256(
        '',
      );

      await load();
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to create Android release.',
      );
    } finally {
      setBusy(
        false,
      );
    }
  }

  async function markReady(
    releaseId:
      string,
  ) {
    if (
      busy
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
      await authenticatedRequest(
        '/admin/ops/android/releases/' +
          releaseId,
        {
          method:
            'PATCH',

          body:
            JSON.stringify({
              status:
                'READY',
            }),
        },
      );

      setMessage(
        'Release marked READY.',
      );

      await load();
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to mark release ready.',
      );
    } finally {
      setBusy(
        false,
      );
    }
  }

  async function publish(
    releaseId:
      string,
  ) {
    if (
      busy
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
      await authenticatedRequest(
        '/admin/ops/android/releases/' +
          releaseId +
          '/publish',
        {
          method:
            'POST',
        },
      );

      setMessage(
        'Release published in its configured channel.',
      );

      await load();
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to publish release.',
      );
    } finally {
      setBusy(
        false,
      );
    }
  }

  return (
    <SecondaryFeaturePage
      eyebrow="SUPER_ADMIN · V3.3"
      title="Android Version Control"
      subtitle="Track Play builds, immutable versionCodes, release channels and production update policy."
      backHref="/more"
      backLabel="More"
      action={
        <FcStatusBadge
          label="Release Registry"
          tone="amber"
        />
      }
    >
      <AdminNavigation />

      <FcPanel className="p-5 sm:p-6">
        <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
              New Play Build
            </p>

            <h2 className="mt-1 text-xl font-black">
              Register Release
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Android package version is source-controlled in apps/android/version.properties. Register the tested artifact here before promoting it through Play tracks.
            </p>

            {message ? (
              <p className="mt-4 text-sm font-black text-emerald-400">
                ✓ {
                  message
                }
              </p>
            ) : null}

            {error ? (
              <p className="mt-4 text-sm font-black text-red-300">
                {
                  error
                }
              </p>
            ) : null}
          </div>

          <form
            onSubmit={
              createRelease
            }
            className="grid gap-3 sm:grid-cols-2"
          >
            <label className="grid gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                Version Code
              </span>

              <input
                required
                inputMode="numeric"
                value={
                  versionCode
                }
                onChange={(
                  event,
                ) =>
                  setVersionCode(
                    event
                      .target
                      .value,
                  )
                }
                placeholder="11"
                className="theme-input min-h-11 rounded-xl border px-3 text-sm outline-none"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                Version Name
              </span>

              <input
                required
                value={
                  versionName
                }
                onChange={(
                  event,
                ) =>
                  setVersionName(
                    event
                      .target
                      .value,
                  )
                }
                placeholder="1.0.9"
                className="theme-input min-h-11 rounded-xl border px-3 text-sm outline-none"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                Play Channel
              </span>

              <select
                value={
                  channel
                }
                onChange={(
                  event,
                ) =>
                  setChannel(
                    event
                      .target
                      .value as
                      AndroidRelease[
                        'channel'
                      ],
                  )
                }
                className="theme-input min-h-11 rounded-xl border px-3 text-sm outline-none"
              >
                <option value="INTERNAL">
                  Internal
                </option>
                <option value="CLOSED">
                  Closed
                </option>
                <option value="PRODUCTION">
                  Production
                </option>
              </select>
            </label>

            <label className="grid gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                Minimum Supported Build
              </span>

              <input
                inputMode="numeric"
                value={
                  minimumSupported
                }
                onChange={(
                  event,
                ) =>
                  setMinimumSupported(
                    event
                      .target
                      .value,
                  )
                }
                placeholder="Optional"
                className="theme-input min-h-11 rounded-xl border px-3 text-sm outline-none"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                Force Update Below
              </span>

              <input
                inputMode="numeric"
                value={
                  forceBelow
                }
                onChange={(
                  event,
                ) =>
                  setForceBelow(
                    event
                      .target
                      .value,
                  )
                }
                placeholder="Optional"
                className="theme-input min-h-11 rounded-xl border px-3 text-sm outline-none"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                Play Store URL
              </span>

              <input
                type="url"
                value={
                  playStoreUrl
                }
                onChange={(
                  event,
                ) =>
                  setPlayStoreUrl(
                    event
                      .target
                      .value,
                  )
                }
                className="theme-input min-h-11 rounded-xl border px-3 text-sm outline-none"
              />
            </label>

            <label className="grid gap-1.5 sm:col-span-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                Release Notes
              </span>

              <textarea
                value={
                  releaseNotes
                }
                onChange={(
                  event,
                ) =>
                  setReleaseNotes(
                    event
                      .target
                      .value,
                  )
                }
                rows={3}
                placeholder="What changed in this build?"
                className="theme-input rounded-xl border px-3 py-3 text-sm outline-none"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                Source Commit
              </span>

              <input
                value={
                  sourceCommit
                }
                onChange={(
                  event,
                ) =>
                  setSourceCommit(
                    event
                      .target
                      .value,
                  )
                }
                placeholder="40-char Git SHA"
                className="theme-input min-h-11 rounded-xl border px-3 font-mono text-xs outline-none"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                AAB SHA-256
              </span>

              <input
                value={
                  artifactSha256
                }
                onChange={(
                  event,
                ) =>
                  setArtifactSha256(
                    event
                      .target
                      .value,
                  )
                }
                placeholder="64-char SHA-256"
                className="theme-input min-h-11 rounded-xl border px-3 font-mono text-xs outline-none"
              />
            </label>

            <button
              type="submit"
              disabled={
                busy
              }
              className="theme-primary-button min-h-11 rounded-xl px-5 text-sm font-black disabled:opacity-50 sm:col-span-2"
            >
              {busy
                ? 'Saving...'
                : 'Create Draft Release'}
            </button>
          </form>
        </div>
      </FcPanel>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">
              Play History
            </p>

            <h2 className="mt-1 text-xl font-black">
              Release Registry
            </h2>
          </div>

          <span className="text-xs text-slate-600">
            {
              releases.length
            }{' '}
            builds
          </span>
        </div>

        <div className="space-y-3">
          {releases.map(
            (
              release,
            ) => (
              <FcPanel
                key={
                  release.id
                }
                className="p-5"
              >
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-black">
                        v{
                          release.versionName
                        }{' '}
                        · Build{' '}
                        {
                          release.versionCode
                        }
                      </h3>

                      <FcStatusBadge
                        label={
                          release.channel
                        }
                        tone="cyan"
                      />

                      <FcStatusBadge
                        label={
                          release.status
                        }
                        tone={
                          statusTone(
                            release.status,
                          )
                        }
                      />
                    </div>

                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {
                        release.releaseNotes ||
                        'No release notes recorded.'
                      }
                    </p>

                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600">
                      <span>
                        Min supported:{' '}
                        {
                          release.minimumSupportedVersionCode ??
                          '—'
                        }
                      </span>

                      <span>
                        Force below:{' '}
                        {
                          release.forceUpdateBelowVersionCode ??
                          '—'
                        }
                      </span>

                      <span>
                        By{' '}
                        {
                          release
                            .createdBy
                            .name
                        }
                      </span>

                      {release.sourceCommit ? (
                        <span className="font-mono">
                          {
                            release.sourceCommit.slice(
                              0,
                              10,
                            )
                          }
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    {release.status ===
                    'DRAFT' ? (
                      <button
                        type="button"
                        disabled={
                          busy
                        }
                        onClick={() =>
                          void markReady(
                            release.id,
                          )
                        }
                        className="theme-secondary-button min-h-10 rounded-xl border px-4 text-xs font-black disabled:opacity-50"
                      >
                        Mark READY
                      </button>
                    ) : null}

                    {release.status ===
                    'READY' ? (
                      <button
                        type="button"
                        disabled={
                          busy
                        }
                        onClick={() =>
                          void publish(
                            release.id,
                          )
                        }
                        className="min-h-10 rounded-xl bg-emerald-400 px-4 text-xs font-black text-[#04130d] disabled:opacity-50"
                      >
                        Publish {
                          release.channel
                        }
                      </button>
                    ) : null}

                    {release.status ===
                    'PUBLISHED' ? (
                      <span className="inline-flex min-h-10 items-center rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-4 text-xs font-black text-emerald-300">
                        ● Current {
                          release.channel
                        }
                      </span>
                    ) : null}
                  </div>
                </div>
              </FcPanel>
            ),
          )}

          {!loading &&
          releases.length ===
            0 ? (
            <FcEmptyState
              title="No Android releases registered"
              description="Create the first release record after the signed AAB has passed validation."
            />
          ) : null}

          {loading ? (
            <FcPanel className="p-8 text-center text-sm text-slate-500">
              Loading Android release registry...
            </FcPanel>
          ) : null}
        </div>
      </section>

      <FcPanel className="p-5 text-xs leading-5 text-slate-500">
        <b className="text-slate-300">
          Release safety:
        </b>{' '}
        Play versionCode must always increase. Published records are immutable. Only a PRODUCTION record drives the native app update prompt; Internal/Closed records remain tracking-only.
      </FcPanel>
    </SecondaryFeaturePage>
  );
}
