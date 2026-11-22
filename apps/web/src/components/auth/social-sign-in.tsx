'use client';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { beginSocialSignIn, type SocialProvider } from '@/lib/social-auth';

export function SocialSignIn() {
  const [providers, setProviders] = useState({
    google: false,
    facebook: false,
  });
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState<SocialProvider | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void apiRequest<{ data: typeof providers }>('/auth/social/providers', {
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted) setProviders(result.data);
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setReady(true);
      });
    return () => controller.abort();
  }, []);
  async function start(provider: SocialProvider) {
    setError('');
    setBusy(provider);
    try {
      await beginSocialSignIn(provider);
    } catch {
      setError('Could not open sign-in. Check your connection and try again.');
      setBusy(null);
    }
  }
  return (
    <section className="mt-5 space-y-3" aria-label="Other sign-in options">
      <div className="flex items-center gap-3 text-xs text-slate-500">
        <span className="h-px flex-1 bg-slate-300/30" />
        or continue with
        <span className="h-px flex-1 bg-slate-300/30" />
      </div>
      {(['google', 'facebook'] as const).map((provider) => (
        <button
          type="button"
          key={provider}
          disabled={!providers[provider] || !!busy}
          onClick={() => void start(provider)}
          aria-busy={busy === provider}
          className="theme-secondary-button flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border px-4 py-3 text-sm font-bold disabled:opacity-50"
        >
          {provider === 'google' ? (
            <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">
              <path
                fill="#4285F4"
                d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.23c1.89-1.74 2.99-4.3 2.99-7.36Z"
              />
              <path
                fill="#34A853"
                d="M12 22c2.7 0 4.96-.9 6.61-2.41l-3.23-2.51c-.9.6-2.05.97-3.38.97-2.6 0-4.8-1.76-5.59-4.12H3.07v2.6A10 10 0 0 0 12 22Z"
              />
              <path
                fill="#FBBC05"
                d="M6.41 13.93a6 6 0 0 1 0-3.86v-2.6H3.07a10 10 0 0 0 0 9.06l3.34-2.6Z"
              />
              <path
                fill="#EA4335"
                d="M12 5.95c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.93 5.47l3.34 2.6A5.99 5.99 0 0 1 12 5.95Z"
              />
            </svg>
          ) : (
            <span
              aria-hidden="true"
              className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1877f2] font-sans text-lg font-black text-white"
            >
              f
            </span>
          )}
          {busy === provider
            ? 'Opening sign-in...'
            : `Continue with ${provider === 'google' ? 'Google' : 'Facebook'}`}
          {ready && !providers[provider] ? (
            <span className="text-xs font-normal">Coming soon</span>
          ) : null}
        </button>
      ))}
      {error ? (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      ) : null}
      <p className="theme-muted text-center text-xs leading-5">
        New players complete their date of birth and WhatsApp number before
        entering the app.
      </p>
    </section>
  );
}
