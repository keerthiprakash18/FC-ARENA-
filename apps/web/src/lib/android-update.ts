export const ANDROID_STORE_URL = 'https://play.google.com/store/apps/details?id=in.fcarena.app';
export const UPDATE_SNOOZE_MS = 12 * 60 * 60 * 1000;
export const UPDATE_SNOOZE_KEY = 'fc-arena:android-update:snooze:v1';

export type AndroidStoreUpdate = {
  checked: boolean; available: boolean; installedVersionCode: number; availableVersionCode: number;
};
export type AndroidVersionPolicy = {
  updateAvailable: boolean;
  latest: { versionCode: number; versionName: string } | null;
};
export type AndroidUpdateNotice = { key: string; versionName: string | null };

export function installedAndroidVersion(agent: string): string | null {
  return /(?:^|\s)FC-Arena-Android\/(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)(?=\s|$)/i.exec(agent)?.[1] ?? null;
}

export function androidUpdateNotice(policy: AndroidVersionPolicy | null, store?: AndroidStoreUpdate): AndroidUpdateNotice | null {
  // A successful Play check is specific to this device/account and its rollout eligibility.
  if (store?.checked) {
    if (!store.available || !Number.isSafeInteger(store.availableVersionCode) ||
      !Number.isSafeInteger(store.installedVersionCode) || store.installedVersionCode < 1 ||
      store.availableVersionCode <= store.installedVersionCode) return null;
    return { key: `code:${store.availableVersionCode}`,
      versionName: policy?.latest?.versionCode === store.availableVersionCode ? policy.latest.versionName : null };
  }
  if (!policy?.updateAvailable || !policy.latest || !Number.isSafeInteger(policy.latest.versionCode) || policy.latest.versionCode < 1) return null;
  return { key: `code:${policy.latest.versionCode}`, versionName: policy.latest.versionName };
}

export function updateIsSnoozed(raw: string | null, key: string, now: number): boolean {
  try {
    const value: unknown = JSON.parse(raw ?? 'null');
    if (!value || typeof value !== 'object' || !('key' in value) || !('until' in value)) return false;
    return value.key === key && typeof value.until === 'number' && value.until > now && value.until <= now + UPDATE_SNOOZE_MS;
  } catch { return false; }
}
