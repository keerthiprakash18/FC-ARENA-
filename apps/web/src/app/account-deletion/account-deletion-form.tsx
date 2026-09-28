'use client';

import {
  FormEvent,
  useState,
} from 'react';

import {
  apiRequest,
} from '@/lib/api';

export function AccountDeletionForm() {
  const [
    email,
    setEmail,
  ] =
    useState('');

  const [
    inGameName,
    setInGameName,
  ] =
    useState('');

  const [
    details,
    setDetails,
  ] =
    useState('');

  const [
    submitting,
    setSubmitting,
  ] =
    useState(false);

  const [
    requestId,
    setRequestId,
  ] =
    useState<string | null>(
      null,
    );

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  async function submit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response =
        await apiRequest<{
          success: true;
          data: {
            requestId:
              string;
            message:
              string;
          };
          error: null;
        }>(
          '/auth/account-deletion-request',
          {
            method:
              'POST',
            body:
              JSON.stringify({
                email,
                inGameName:
                  inGameName ||
                  undefined,
                details:
                  details ||
                  undefined,
              }),
          },
        );

      setRequestId(
        response
          .data
          .requestId,
      );
    } catch (
      caught
    ) {
      setError(
        caught instanceof
          Error
          ? caught.message
          : 'Unable to submit the request. Please try again.',
      );
    } finally {
      setSubmitting(
        false,
      );
    }
  }

  if (requestId) {
    return (
      <div className="theme-soft-accent rounded-2xl border p-5 sm:p-6">
        <h2 className="theme-text text-lg font-semibold">
          Request received
        </h2>

        <p className="theme-secondary-text mt-2 text-sm leading-7">
          Your FC ARENA account and data deletion request has been recorded. We may contact the email address you supplied to verify account ownership before completing deletion.
        </p>

        <p className="theme-muted mt-4 text-xs">
          Request reference: <span className="font-mono">{requestId}</span>
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="theme-panel space-y-5 rounded-2xl border p-5 sm:p-6"
    >
      <div>
        <label
          htmlFor="deletion-email"
          className="theme-text block text-sm font-semibold"
        >
          Account email
        </label>

        <input
          id="deletion-email"
          type="email"
          required
          maxLength={255}
          autoComplete="email"
          value={email}
          onChange={(event) =>
            setEmail(
              event.target.value,
            )
          }
          className="theme-input mt-2 min-h-11 w-full rounded-[10px] border px-3 text-sm"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label
          htmlFor="deletion-ign"
          className="theme-text block text-sm font-semibold"
        >
          In-Game Name (optional)
        </label>

        <input
          id="deletion-ign"
          type="text"
          maxLength={80}
          value={inGameName}
          onChange={(event) =>
            setInGameName(
              event.target.value,
            )
          }
          className="theme-input mt-2 min-h-11 w-full rounded-[10px] border px-3 text-sm"
          placeholder="Your FC ARENA in-game name"
        />
      </div>

      <div>
        <label
          htmlFor="deletion-details"
          className="theme-text block text-sm font-semibold"
        >
          Additional details (optional)
        </label>

        <textarea
          id="deletion-details"
          maxLength={1000}
          rows={4}
          value={details}
          onChange={(event) =>
            setDetails(
              event.target.value,
            )
          }
          className="theme-input mt-2 w-full rounded-[10px] border px-3 py-3 text-sm"
          placeholder="Anything that helps us identify the account. Do not enter your password or OTP."
        />
      </div>

      {error ? (
        <p
          role="alert"
          className="text-sm text-red-400"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="theme-danger-button min-h-11 w-full rounded-[10px] border px-4 text-sm font-semibold transition disabled:opacity-50"
      >
        {submitting
          ? 'Submitting...'
          : 'Request account & data deletion'}
      </button>

      <p className="theme-muted text-xs leading-6">
        Never submit a password, one-time password (OTP), payment information or other secret credentials in this form.
      </p>
    </form>
  );
}
