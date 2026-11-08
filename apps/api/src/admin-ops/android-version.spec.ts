import { describe, expect, it, vi } from 'vitest';
import { compareAndroidVersions } from './android-version.js';
import { AdminOpsService } from './admin-ops.service.js';

describe('Android release names', () => {
  it.each([
    ['1.0.9', '1.0.18', -1],
    ['1.0.18', '1.0.18', 0],
    ['1.0.19', '1.0.18', 1],
    ['2.0.0', '1.99.99', 1],
    ['1.0.18-beta.9', '1.0.18-beta.10', -1],
    ['1.0.18-beta', '1.0.18', -1],
    ['1.0.18+build20', '1.0.18', 0],
    ['1.0.18', '1.0.18-beta', 1],
    ['1.0', '1.0.18', null],
    ['1.00.18', '1.0.18', null],
    ['1.0.18-beta.01', '1.0.18', null],
    ['javascript:alert(1)', '1.0.18', null],
  ])('compares %s with %s', (a, b, result) =>
    expect(compareAndroidVersions(a, b)).toBe(result),
  );
});

describe('Published Android policy', () => {
  const release = {
    versionCode: 20,
    versionName: '1.0.18',
    minimumSupportedVersionCode: 10,
    forceUpdateBelowVersionCode: 15,
    releaseNotes: 'Improvements',
    playStoreUrl: null,
    publishedAt: new Date(),
  };
  function setup(value: object | null = release) {
    const prisma: any = {
      androidRelease: { findFirst: vi.fn().mockResolvedValue(value) },
    };
    return { service: new AdminOpsService(prisma), prisma };
  }
  it('uses installed names for existing WebViews without confusing 1.0.9 and 1.0.18', async () => {
    const { service, prisma } = setup();
    expect(
      (await service.androidVersionPolicy(undefined, '1.0.9')).data
        .updateAvailable,
    ).toBe(true);
    expect(
      (await service.androidVersionPolicy(undefined, '1.0.18')).data
        .updateAvailable,
    ).toBe(false);
    expect(
      (await service.androidVersionPolicy(undefined, '1.0.19')).data
        .updateAvailable,
    ).toBe(false);
    expect(prisma.androidRelease.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          channel: 'PRODUCTION',
          status: 'PUBLISHED',
          publishedAt: { lte: expect.any(Date) },
        },
      }),
    );
  });
  it('retains code-based force policy and does not infer force thresholds from an unknown code', async () => {
    const { service } = setup();
    expect((await service.androidVersionPolicy('14')).data.forceUpdate).toBe(
      true,
    );
    expect((await service.androidVersionPolicy('17')).data.forceUpdate).toBe(
      false,
    );
    expect(
      (await service.androidVersionPolicy(undefined, '1.0.15')).data
        .forceUpdate,
    ).toBe(false);
  });
  it.each(['', '-1', 'NaN', '1e1', '1.5', '2147483648', '017'])(
    'ignores malformed code %s even alongside a name',
    async (code) => {
      const { service } = setup();
      expect(
        (await service.androidVersionPolicy(code, '1.0.1')).data
          .updateAvailable,
      ).toBe(false);
    },
  );
  it('does not advertise unpublished candidates or guess a version for regular browsers', async () => {
    expect(
      (await setup(null).service.androidVersionPolicy('17')).data.latest,
    ).toBe(null);
    expect(
      (await setup().service.androidVersionPolicy()).data.updateAvailable,
    ).toBe(false);
  });
});
