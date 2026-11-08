const RELEASE = /^[0-9a-f]{40}$/i;

export function newerWebRelease(loaded: string | undefined, response: unknown): string | null {
  if (!loaded || !RELEASE.test(loaded) || !response || typeof response !== 'object' || !('release' in response)) return null;
  const next = response.release;
  return typeof next === 'string' && RELEASE.test(next) && next.toLowerCase() !== loaded.toLowerCase() ? next : null;
}

export function freshAppUrl(currentUrl: string, release: string) {
  if (!RELEASE.test(release)) throw new Error('Invalid web release');
  const url = new URL(currentUrl);
  url.searchParams.set('fc_native_refresh', release);
  return url.toString();
}
