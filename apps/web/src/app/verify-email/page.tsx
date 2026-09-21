'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FormEvent,
  useEffect,
  useState,
} from 'react';

import {
  AuthCard,
} from '@/components/auth/auth-card';

import {
  apiRequest,
} from '@/lib/api';


const RESEND_COOLDOWN_SECONDS =
  60;


function storedValue(
  key: string,
): string {
  if (
    typeof window ===
    'undefined'
  ) {
    return '';
  }

  return (
    sessionStorage.getItem(
      key,
    ) ?? ''
  );
}


function initialCooldown(): number {
  if (
    typeof window ===
    'undefined'
  ) {
    return 0;
  }

  const sentAt =
    Number(
      sessionStorage.getItem(
        'fc_auth_otp_sent_at',
      ) ?? 0,
    );

  if (
    !Number.isFinite(
      sentAt,
    ) ||
    sentAt <= 0
  ) {
    return 0;
  }

  return Math.max(
    0,
    RESEND_COOLDOWN_SECONDS -
      Math.floor(
        (Date.now() -
          sentAt) /
          1000,
      ),
  );
}


export default function VerifyEmailPage() {
  const router =
    useRouter();

  const [
    email,
    setEmail,
  ] =
    useState(
      () =>
        storedValue(
          'fc_auth_email',
        ),
    );

  const [
    otp,
    setOtp,
  ] =
    useState(
      () =>
        storedValue(
          'fc_auth_dev_otp',
        ),
    );

  const [
    devOtp,
    setDevOtp,
  ] =
    useState(
      () =>
        storedValue(
          'fc_auth_dev_otp',
        ),
    );

  const [
    cooldown,
    setCooldown,
  ] =
    useState(
      initialCooldown,
    );

  const [
    error,
    setError,
  ] =
    useState('');

  const [
    message,
    setMessage,
  ] =
    useState(
      () =>
        storedValue(
          'fc_auth_verification_notice',
        ),
    );

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    resendLoading,
    setResendLoading,
  ] =
    useState(false);


  useEffect(
    () => {
      const timer =
        window.setInterval(
          () => {
            setCooldown(
              (
                current,
              ) =>
                current >
                0
                  ? current -
                    1
                  : 0,
            );
          },
          1000,
        );

      return () =>
        window.clearInterval(
          timer,
        );
    },
    [],
  );


  async function submit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError(
      '',
    );

    setMessage(
      '',
    );

    setLoading(
      true,
    );

    try {
      await apiRequest(
        '/auth/verify-email',
        {
          method:
            'POST',

          body:
            JSON.stringify({
              email:
                email
                  .trim()
                  .toLowerCase(),

              otp,
            }),
        },
      );

      sessionStorage.removeItem(
        'fc_auth_dev_otp',
      );

      sessionStorage.removeItem(
        'fc_auth_otp_sent_at',
      );

      sessionStorage.removeItem(
        'fc_auth_email',
      );

      sessionStorage.removeItem(
        'fc_auth_verification_notice',
      );

      router.push(
        '/login',
      );
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Verification failed.',
      );
    } finally {
      setLoading(
        false,
      );
    }
  }


  async function resend() {
    if (
      cooldown >
        0 ||
      resendLoading ||
      !email.trim()
    ) {
      return;
    }

    setError(
      '',
    );

    setMessage(
      '',
    );

    setResendLoading(
      true,
    );

    try {
      const result =
        await apiRequest<{
          data: {
            developmentOtp?: string;
            message: string;
          };
        }>(
          '/auth/resend-verification',
          {
            method:
              'POST',

            body:
              JSON.stringify({
                email:
                  email
                    .trim()
                    .toLowerCase(),
              }),
          },
        );

      const sentAt =
        Date.now();

      sessionStorage.setItem(
        'fc_auth_email',
        email
          .trim()
          .toLowerCase(),
      );

      sessionStorage.setItem(
        'fc_auth_otp_sent_at',
        String(
          sentAt,
        ),
      );

      setCooldown(
        RESEND_COOLDOWN_SECONDS,
      );

      sessionStorage.removeItem(
        'fc_auth_verification_notice',
      );

      setMessage(
        'A new OTP was sent. Use the newest code within 10 minutes. Check Spam/Junk/Promotions if needed.',
      );

      if (
        result
          .data
          .developmentOtp
      ) {
        setDevOtp(
          result
            .data
            .developmentOtp,
        );

        setOtp(
          result
            .data
            .developmentOtp,
        );

        sessionStorage.setItem(
          'fc_auth_dev_otp',
          result
            .data
            .developmentOtp,
        );
      }
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to resend OTP.',
      );
    } finally {
      setResendLoading(
        false,
      );
    }
  }


  return (
    <AuthCard
      eyebrow="ACCOUNT VERIFICATION"
      title="Verify your email"
      description="Enter the six-digit code sent to your email. The newest OTP stays valid for 10 minutes."
    >
      <form
        className="auth-form"
        onSubmit={
          submit
        }
      >
        <div className="field">
          <label>
            Email
          </label>

          <input
            type="email"
            value={
              email
            }
            onChange={
              (
                event,
              ) =>
                setEmail(
                  event
                    .target
                    .value,
                )
            }
            autoComplete="email"
            required
          />
        </div>


        <div className="field">
          <label>
            6-digit OTP
          </label>

          <input
            value={
              otp
            }
            onChange={
              (
                event,
              ) =>
                setOtp(
                  event
                    .target
                    .value
                    .replace(
                      /\D/g,
                      '',
                    )
                    .slice(
                      0,
                      6,
                    ),
                )
            }
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={
              6
            }
            pattern="[0-9]{6}"
            required
          />
        </div>


        <div className="rounded-xl border border-sky-400/15 bg-sky-400/[0.04] p-3 text-xs leading-5 text-slate-400">
          Email delivery can take a short moment depending on the provider. Use only the newest OTP. If it is not in Inbox, check Spam, Junk and Promotions before requesting another code.
        </div>


        {devOtp ? (
          <div className="dev-otp">
            DEVELOPMENT OTP: {
              devOtp
            }
          </div>
        ) : null}


        {error ? (
          <div className="error-box">
            {
              error
            }
          </div>
        ) : null}


        {message ? (
          <div className="success-box">
            {
              message
            }
          </div>
        ) : null}


        <button
          className="primary-button"
          type="submit"
          disabled={
            loading ||
            otp.length !==
              6
          }
        >
          {loading
            ? 'Verifying...'
            : 'Verify Account'}
        </button>


        <button
          className="secondary-button"
          type="button"
          onClick={
            resend
          }
          disabled={
            resendLoading ||
            cooldown >
              0 ||
            !email.trim()
          }
        >
          {resendLoading
            ? 'Sending OTP...'
            : cooldown >
                0
              ? `Resend OTP in ${cooldown}s`
              : 'Resend OTP'}
        </button>
      </form>


      <div className="link-row">
        <Link
          className="text-link"
          href="/login"
        >
          Return to login
        </Link>
      </div>
    </AuthCard>
  );
}
