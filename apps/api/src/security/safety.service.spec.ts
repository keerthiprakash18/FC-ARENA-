import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  SafetyService,
} from './safety.service.js';

describe(
  'Safety moderation controls',
  () => {
    it(
      'does not allow a normal user to open the admin moderation queue',
      async () => {
        const prisma:
          any = {
          user: {
            findUnique:
              vi.fn()
                .mockResolvedValue({
                  role:
                    'USER',
                }),
          },
        };

        const service =
          new SafetyService(
            prisma,
            {} as any,
          );

        await expect(
          service.getAdminReports(
            'normal-user',
          ),
        ).rejects.toMatchObject({
          status: 403,
        });
      },
    );

    it(
      'records an explicit dismissed moderation outcome',
      async () => {
        const record =
          vi.fn()
            .mockResolvedValue({
              id:
                'resolution',
              createdAt:
                new Date(
                  '2026-10-03T00:00:00Z',
                ),
            });

        const prisma:
          any = {
          user: {
            findUnique:
              vi.fn()
                .mockResolvedValue({
                  role:
                    'SUPER_ADMIN',
                }),
          },
          auditLog: {
            findUnique:
              vi.fn()
                .mockResolvedValue({
                  id:
                    'report',
                  action:
                    'UGC_REPORT_SUBMITTED',
                  targetId:
                    'target-user',
                }),
            findFirst:
              vi.fn()
                .mockResolvedValue(
                  null,
                ),
          },
        };

        const service =
          new SafetyService(
            prisma,
            {
              record,
            } as any,
          );

        const result =
          await service.resolveReport(
            'admin',
            'report',
            {
              decision:
                'DISMISSED',
              note:
                'No violation found.',
            },
          );

        expect(
          record,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            action:
              'UGC_REPORT_RESOLVED',
            metadata:
              expect.objectContaining({
                status:
                  'DISMISSED',
              }),
          }),
        );

        expect(
          result.data.decision,
        ).toBe(
          'DISMISSED',
        );
      },
    );

    it(
      'prevents reporting your own account',
      async () => {
        const prisma:
          any = {
          playerIdentity: {
            findUnique:
              vi.fn()
                .mockResolvedValue({
                  inGameName:
                    'SamePlayer',
                  player: {
                    playerCode:
                      'FCA-P-1',
                    profileImageUrl:
                      null,
                    user: {
                      id:
                        'same-user',
                      fullName:
                        'Same User',
                      status:
                        'ACTIVE',
                    },
                  },
                }),
          },
        };

        const audit = {
          record:
            vi.fn(),
        };

        const service =
          new SafetyService(
            prisma,
            audit as any,
          );

        await expect(
          service.reportUserContent(
            'same-user',
            {
              targetInGameName:
                'SamePlayer',
              reason:
                'OTHER',
              contentType:
                'USER_PROFILE',
            },
          ),
        ).rejects.toMatchObject({
          status: 400,
        });

        expect(
          audit.record,
        ).not
          .toHaveBeenCalled();
      },
    );
  },
);
