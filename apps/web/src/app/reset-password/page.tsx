'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { AuthCard } from '@/components/auth/auth-card';
import { FcNotice } from '@/components/fc/fc-ui';
import { apiRequest } from '@/lib/api';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState(() =>
    typeof window === 'undefined'
      ? ''
      : sessionStorage.getItem('fc_reset_email') ?? '',
  );
  const [otp, setOtp] = useState(() =>
    typeof window === 'undefined'
      ? ''
      : sessionStorage.getItem('fc_reset_dev_otp') ?? '',
  );
  const [devOtp, setDevOtp] = useState(() =>
    typeof window === 'undefined'
      ? ''
      : sessionStorage.getItem('fc_reset_dev_otp') ?? '',
  );
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resending, setResending] = useState(false);
  const [notice, setNotice] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(0);
  const [cooldownReady, setCooldownReady] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem('fc_reset_last_request') || 'null');
      setResendAt(saved?.email === email.trim().toLowerCase() && Number.isFinite(saved.sentAt) ? Math.min(saved.sentAt + 60_000, Date.now() + 60_000) : 0);
    } catch { setResendAt(0); }
    setNow(Date.now()); setCooldownReady(true);
  }, [email]);
  const remaining = Math.max(0, Math.ceil((resendAt - now) / 1000));
  useEffect(() => {
    if (!remaining) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [remaining]);

  async function resend(event: React.MouseEvent<HTMLButtonElement>) {
    const emailInput = event.currentTarget.form?.querySelector<HTMLInputElement>('[type="email"]');
    if (!emailInput?.reportValidity() || remaining || resending || loading) return;
    setResending(true); setError(''); setNotice('');
    try {
      const response = await apiRequest<{ data: { developmentOtp?: string } }>('/auth/forgot-password', {
        method: 'POST', body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const sentAt = Date.now();
      setNow(sentAt); setResendAt(sentAt + 60_000); setOtp('');
      setDevOtp(response.data.developmentOtp ?? '');
      try {
        sessionStorage.setItem('fc_reset_email', email);
        sessionStorage.setItem('fc_reset_last_request', JSON.stringify({ email: email.trim().toLowerCase(), sentAt }));
        sessionStorage.removeItem('fc_reset_dev_otp');
        if (response.data.developmentOtp) sessionStorage.setItem('fc_reset_dev_otp', response.data.developmentOtp);
      } catch { /* Resending still succeeds when device storage is unavailable. */ }
      setNotice('If an active account matches this email, a new reset code has been requested. Check your inbox and spam folder.');
    } catch (caught) {
      // A failed response may follow delivery; respect the server cooldown before another request.
      const failedAt = Date.now(); setNow(failedAt); setResendAt(failedAt + 60_000);
      setError(caught instanceof Error ? caught.message : 'Unable to request a new code.');
    } finally { setResending(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    const form = new FormData(event.currentTarget);

    try {
      await apiRequest('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          email,
          otp,
          newPassword: String(form.get('newPassword') ?? ''),
          confirmPassword: String(
            form.get('confirmPassword') ?? '',
          ),
        }),
      });

      sessionStorage.removeItem('fc_reset_email');
      sessionStorage.removeItem('fc_reset_dev_otp');
      sessionStorage.removeItem('fc_reset_last_request');

      router.push('/login');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Password reset failed.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      eyebrow="SECURE RESET"
      title="Choose a new password"
      description="Verify the reset code and secure your account with a new password."
    >
      <form className="auth-form" onSubmit={submit}>
        <div className="field">
          <label htmlFor="auth-email">Email</label>
          <input
            id="auth-email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="auth-otp">6-digit OTP</label>
          <input
            id="auth-otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={otp}
            onChange={(event) => setOtp(event.target.value)}
            maxLength={6}
            required
          />
        </div>

        {devOtp ? (
          <div className="dev-otp">
            DEVELOPMENT OTP: {devOtp}
          </div>
        ) : null}

        <div className="field">
          <p className="theme-muted text-sm">Code not received? Check your spam folder or request another code.</p>
          <button type="button" disabled={!cooldownReady || resending || loading || remaining > 0} onClick={resend} className="theme-secondary-button min-h-11 rounded-xl border px-4 py-3 text-sm font-bold disabled:opacity-50">
            {resending ? 'Requesting code...' : remaining ? `Resend code in ${remaining}s` : 'Resend code'}
          </button>
        </div>

        <div className="field">
          <label htmlFor="auth-newPassword">New Password</label>
          <div className="relative">
            <input
              id="auth-newPassword"
              name="newPassword"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={8}
              pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{8,}"
              title="Use at least 8 characters with uppercase, lowercase and a number."
              style={{ paddingRight: '5rem' }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-pressed={showPassword}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-sky-500 transition hover:text-sky-300"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Must be at least 8 characters with one uppercase letter, one lowercase letter and one number. Maximum 72 UTF-8 bytes.
          </p>
        </div>

        <div className="field">
          <label htmlFor="auth-confirmPassword">Confirm Password</label>
          <div className="relative">
            <input
              id="auth-confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              style={{ paddingRight: '5rem' }}
            />
            <button
              type="button"
              onClick={() =>
                setShowConfirmPassword((value) => !value)
              }
              aria-pressed={showConfirmPassword}
              aria-label={
                showConfirmPassword
                  ? 'Hide confirm password'
                  : 'Show confirm password'
              }
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-sky-500 transition hover:text-sky-300"
            >
              {showConfirmPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <FcNotice tone="error">{error}</FcNotice>
        <FcNotice>{notice}</FcNotice>

        <button
          className="primary-button"
          type="submit"
          disabled={loading || resending}
          aria-busy={loading}
        >
          {loading ? 'Resetting...' : 'Reset Password'}
        </button>
      </form>

      <div className="link-row">
        <Link className="text-link" href="/login">
          Return to login
        </Link>
      </div>
    </AuthCard>
  );
}
