'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AuthCard } from '@/components/auth/auth-card';
import {
  getCurrentUser,
  authenticatedRequest,
  invalidateAppReadCaches,
  logoutCurrentUser,
  type CurrentUser,
} from '@/lib/auth-client';
import { todayForBirthDate } from '@/lib/date-of-birth';
import { signedInDestination } from '@/lib/required-profile';

export default function CompleteProfilePage() {
  const router = useRouter(),
    [user, setUser] = useState<CurrentUser | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void getCurrentUser({ signal: controller.signal })
      .then((value) => {
        if (!controller.signal.aborted) setUser(value);
      })
      .catch(() => {
        if (!controller.signal.aborted) router.replace('/login');
      });
    return () => controller.abort();
  }, [router]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const response = await authenticatedRequest<{
        data: { dateOfBirth: string; phoneNumber: string };
      }>('/auth/me/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          dateOfBirth: form.get('dateOfBirth'),
          phoneNumber: form.get('phoneNumber'),
        }),
      });
      invalidateAppReadCaches();
      router.replace(
        signedInDestination(response.data, window.location.search),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not save your profile. Please retry.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthCard
      eyebrow="COMPLETE YOUR ACCOUNT"
      title="Your player details"
      description="Add your date of birth and WhatsApp number to continue. Both fields are required."
    >
      {user ? (
        <form className="auth-form" onSubmit={submit}>
          <div className="field">
            <label htmlFor="complete-dob">Date of birth</label>
            <input
              id="complete-dob"
              name="dateOfBirth"
              type="date"
              autoComplete="bday"
              min="1900-01-01"
              max={todayForBirthDate()}
              defaultValue={user.dateOfBirth ?? ''}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="complete-whatsapp">WhatsApp number</label>
            <input
              id="complete-whatsapp"
              name="phoneNumber"
              type="tel"
              autoComplete="tel"
              placeholder="+91 98765 43210"
              minLength={8}
              maxLength={30}
              defaultValue={user.phoneNumber ?? ''}
              required
            />
          </div>
          <p className="theme-muted text-sm">
            These account details stay private. Sharing a WhatsApp contact with
            other players is a separate choice in your profile.
          </p>
          {error ? (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          ) : null}
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? 'Saving...' : 'Save and continue'}
          </button>
        </form>
      ) : (
        <p role="status">Loading your account...</p>
      )}
      <button
        type="button"
        className="text-link mt-5 min-h-11"
        onClick={() => {
          void logoutCurrentUser()
            .then(() => router.replace('/login'))
            .catch(() => setError('Could not sign out. Please retry.'));
        }}
      >
        Sign out
      </button>
    </AuthCard>
  );
}
