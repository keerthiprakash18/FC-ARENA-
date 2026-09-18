'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { AuthCard } from '@/components/auth/auth-card';
import { apiRequest } from '@/lib/api';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '');

    try {
      const result = await apiRequest<{
        data: {
          developmentOtp?: string;
        };
      }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });

      sessionStorage.setItem('fc_reset_email', email);

      if (result.data.developmentOtp) {
        sessionStorage.setItem(
          'fc_reset_dev_otp',
          result.data.developmentOtp,
        );
      }

      router.push('/reset-password');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Request failed.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      eyebrow="ACCOUNT RECOVERY"
      title="Reset your password"
      description="Request a secure six-digit password reset code."
    >
      <form className="auth-form" onSubmit={submit}>
        <div className="field">
          <label>Email</label>
          <input name="email" type="email" required />
        </div>

        {error ? <div className="error-box">{error}</div> : null}

        <button
          className="primary-button"
          type="submit"
          disabled={loading}
        >
          {loading ? 'Generating code...' : 'Continue'}
        </button>
      </form>

      <div className="link-row">
        <Link className="text-link" href="/login">
          Back to login
        </Link>
      </div>
    </AuthCard>
  );
}