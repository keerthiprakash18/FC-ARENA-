'use client';

import {
  useEffect,
  useState,
} from 'react';

import {
  authenticatedRequest,
  getCurrentUser,
  logoutCurrentUser,
} from '@/lib/auth-client';

export function AuthenticatedAccountDeletion() {
  const [
    signedIn,
    setSignedIn,
  ] =
    useState(false);

  const [
    checking,
    setChecking,
  ] =
    useState(true);

  const [
    password,
    setPassword,
  ] =
    useState('');

  const [
    confirmation,
    setConfirmation,
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
    deleted,
    setDeleted,
  ] =
    useState(false);

  useEffect(() => {
    let active =
      true;

    void getCurrentUser()
      .then(
        () => {
          if (
            active
          ) {
            setSignedIn(
              true,
            );
          }
        },
      )
      .catch(
        () => {
          if (
            active
          ) {
            setSignedIn(
              false,
            );
          }
        },
      )
      .finally(
        () => {
          if (
            active
          ) {
            setChecking(
              false,
            );
          }
        },
      );

    return () => {
      active =
        false;
    };
  }, []);

  if (
    checking ||
    !signedIn
  ) {
    return null;
  }

  if (
    deleted
  ) {
    return (
      <section
        className="theme-panel rounded-2xl border p-5 sm:p-6"
        role="status"
      >
        <h2 className="theme-text text-lg font-semibold">
          Account deleted
        </h2>

        <p className="theme-secondary-text mt-2 text-sm leading-6">
          Your sign-in credentials and personal profile data have been removed or anonymized. Required competition history remains only in de-identified form.
        </p>

        <a
          href="/login"
          className="theme-primary-button mt-5 inline-flex min-h-11 items-center rounded-[10px] px-5 text-sm font-semibold"
        >
          Return to Login
        </a>
      </section>
    );
  }

  async function deleteNow() {
    if (
      busy ||
      confirmation !==
        'DELETE' ||
      !password
    ) {
      return;
    }

    const accepted =
      window.confirm(
        'This permanently deletes your FC ARENA account and signs you out. Continue?',
      );

    if (
      !accepted
    ) {
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
        '/auth/account',
        {
          method:
            'DELETE',
          body:
            JSON.stringify({
              password,
              confirmation,
            }),
        },
      );

      /*
       * The server has already invalidated every session. This call clears
       * client-only auth/theme state even when the refresh cookie is gone.
       */
      await logoutCurrentUser()
        .catch(
          () =>
            undefined,
        );

      setPassword(
        '',
      );

      setConfirmation(
        '',
      );

      setDeleted(
        true,
      );
    } catch (
      deleteError
    ) {
      setError(
        deleteError instanceof
          Error
          ? deleteError.message
          : 'Unable to delete your account. Please retry.',
      );
    } finally {
      setBusy(
        false,
      );
    }
  }

  return (
    <section className="theme-panel rounded-2xl border p-5 sm:p-6">
      <h2 className="theme-text text-lg font-semibold">
        Delete now while signed in
      </h2>

      <p className="theme-secondary-text mt-2 text-sm leading-6">
        Confirm with your current password. This immediately disables all sessions, removes push tokens and personal notifications, removes stored personal images where applicable, and anonymizes the identity attached to retained competition records.
      </p>

      <div className="mt-5 grid gap-4">
        <label className="grid gap-2">
          <span className="text-sm font-medium">
            Current password
          </span>

          <input
            type="password"
            autoComplete="current-password"
            value={
              password
            }
            onChange={
              (
                event,
              ) =>
                setPassword(
                  event.target
                    .value,
                )
            }
            className="theme-input min-h-11 rounded-[10px] border px-3"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium">
            Type DELETE to confirm
          </span>

          <input
            value={
              confirmation
            }
            onChange={
              (
                event,
              ) =>
                setConfirmation(
                  event.target
                    .value,
                )
            }
            autoComplete="off"
            spellCheck={
              false
            }
            className="theme-input min-h-11 rounded-[10px] border px-3"
          />
        </label>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-4 text-sm text-red-600"
        >
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={
          busy ||
          !password ||
          confirmation !==
            'DELETE'
        }
        onClick={
          () =>
            void deleteNow()
        }
        className="theme-danger-button mt-5 min-h-11 rounded-[10px] border px-5 text-sm font-semibold disabled:opacity-50"
      >
        {busy
          ? 'Deleting...'
          : 'Permanently delete account'}
      </button>
    </section>
  );
}
