import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  PushService,
} from './push.service.js';

vi.mock(
  'firebase-admin/app',
  () => ({
    initializeApp:
      vi.fn(),
    cert:
      vi.fn(),
  }),
);

const {
  send,
} =
  vi.hoisted(
    () => ({
      send:
        vi.fn()
          .mockResolvedValue(
            'sent',
          ),
    }),
  );

vi.mock(
  'firebase-admin/messaging',
  () => ({
    getMessaging:
      () => ({
        send,
      }),
  }),
);

describe(
  'Push session and delivery isolation',
  () => {
    it(
      'reports configuration and current-session binding separately',
      async () => {
        const prisma:
          any = {
          pushDevice: {
            count:
              vi.fn()
                .mockResolvedValue(
                  0,
                ),
          },
        };

        const service =
          new PushService(
            prisma,
            {} as any,
          );

        const status =
          await service.status(
            'user',
            'session',
          );

        expect(
          status.data
            .configured,
        ).toBe(
          false,
        );

        expect(
          status.data.bound,
        ).toBe(
          false,
        );
      },
    );

    it(
      'does not register a device when the sender is not configured',
      async () => {
        const service =
          new PushService(
            {} as any,
            {} as any,
          );

        await expect(
          service.register(
            'user',
            'session',
            'token',
          ),
        ).rejects.toThrow(
          'not available',
        );
      },
    );

    it(
      'rejects expired or revoked sessions before persisting a token',
      async () => {
        const prisma:
          any = {
          refreshSession: {
            findFirst:
              vi.fn()
                .mockResolvedValue(
                  null,
                ),
          },
          pushDevice: {
            upsert:
              vi.fn(),
          },
        };

        const service =
          new PushService(
            prisma,
            {} as any,
          );

        (
          service as any
        ).app = {};

        await expect(
          service.register(
            'user',
            'session',
            'token-token-token-token',
          ),
        ).rejects.toThrow(
          'Sign in again',
        );

        expect(
          prisma
            .pushDevice
            .upsert,
        ).not
          .toHaveBeenCalled();
      },
    );

    it(
      'prioritizes a refreshed FCM token for the next worker cycle',
      async () => {
        const prisma:
          any = {
          refreshSession: {
            findFirst:
              vi.fn()
                .mockResolvedValue(
                  {
                    id:
                      'session',
                  },
                ),
          },
          pushDevice: {
            deleteMany:
              vi.fn()
                .mockResolvedValue({
                  count: 0,
                }),
            findUnique:
              vi.fn()
                .mockResolvedValue(
                  null,
                ),
            count:
              vi.fn()
                .mockResolvedValue(
                  0,
                ),
            upsert:
              vi.fn()
                .mockResolvedValue(
                  {},
                ),
          },
        };

        const service =
          new PushService(
            prisma,
            {} as any,
          );

        (
          service as any
        ).app = {};

        await service.register(
          'user',
          'session',
          'token-token-token-token',
        );

        expect(
          prisma
            .pushDevice
            .upsert,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            create:
              expect.objectContaining({
                lastSyncedAt:
                  new Date(0),
              }),
          }),
        );
      },
    );

    it(
      'does not deliver when consent or session is revoked during sync',
      async () => {
        send.mockClear();

        const device = {
          id: 'device',
          userId:
            'user',
          sessionId:
            'session',
          enabledAt:
            new Date(),
          lastSyncedAt:
            new Date(),
          token:
            'token',
        };

        const prisma:
          any = {
          pushDevice: {
            deleteMany:
              vi.fn()
                .mockResolvedValue({
                  count: 0,
                }),
            findMany:
              vi.fn()
                .mockResolvedValue([
                  device,
                ]),
            update:
              vi.fn(),
            findFirst:
              vi.fn()
                .mockResolvedValue(
                  null,
                ),
          },
          notification: {
            findMany:
              vi.fn()
                .mockResolvedValue([
                  {
                    id:
                      'notice',
                  },
                ]),
          },
        };

        const service =
          new PushService(
            prisma,
            {
              syncForUser:
                vi.fn(),
            } as any,
          );

        (
          service as any
        ).app = {};

        await service.tick();

        expect(
          send,
        ).not
          .toHaveBeenCalled();

        expect(
          prisma
            .pushDevice
            .findMany
            .mock
            .calls[0][0]
            .where
            .session
            .revokedAt,
        ).toBeNull();
      },
    );

    it(
      'scopes device disabling to the authenticated owner',
      async () => {
        const prisma:
          any = {
          pushDevice: {
            deleteMany:
              vi.fn()
                .mockResolvedValue({
                  count: 1,
                }),
          },
        };

        await new PushService(
          prisma,
          {} as any,
        ).disable(
          'owner',
          'token',
        );

        expect(
          prisma
            .pushDevice
            .deleteMany,
        ).toHaveBeenCalledWith({
          where: {
            userId:
              'owner',
            token:
              'token',
          },
        });
      },
    );

    it(
      'can disable every device bound to the current refresh session',
      async () => {
        const prisma:
          any = {
          pushDevice: {
            deleteMany:
              vi.fn()
                .mockResolvedValue({
                  count: 2,
                }),
          },
        };

        const result =
          await new PushService(
            prisma,
            {} as any,
          ).disableSession(
            'owner',
            'session',
          );

        expect(
          prisma
            .pushDevice
            .deleteMany,
        ).toHaveBeenCalledWith({
          where: {
            userId:
              'owner',
            sessionId:
              'session',
          },
        });

        expect(
          result.data.removed,
        ).toBe(
          2,
        );
      },
    );
  },
);
