import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  AuthService,
} from './auth.service.js';


describe(
  'AuthService registration OTP recovery',
  () => {
    beforeEach(
      () => {
        process.env.JWT_ACCESS_SECRET =
          'test-access-secret';

        process.env.JWT_REFRESH_SECRET =
          'test-refresh-secret';
      },
    );


    it(
      'keeps a pending account when the first verification email fails',
      async () => {
        const tx = {
          user: {
            create:
              vi.fn()
                .mockResolvedValue({
                  id:
                    'user-1',
                  fullName:
                    'Test Player',
                  email:
                    'player@example.com',
                  status:
                    'PENDING_VERIFICATION',
                }),
          },

          player: {
            create:
              vi.fn()
                .mockResolvedValue({
                  id:
                    'player-1',
                  serialNumber:
                    1,
                }),

            update:
              vi.fn()
                .mockResolvedValue({
                  id:
                    'player-1',
                  playerCode:
                    'FCA-P-000001',
                }),
          },

          playerIdentity: {
            create:
              vi.fn()
                .mockResolvedValue({
                  id:
                    'identity-1',
                }),
          },

          authOtp: {
            create:
              vi.fn()
                .mockResolvedValue({
                  id:
                    'otp-1',
                }),
          },
        };

        const userDelete =
          vi.fn();

        const otpDelete =
          vi.fn()
            .mockResolvedValue({});

        const prisma = {
          user: {
            findUnique:
              vi.fn()
                .mockResolvedValue(
                  null,
                ),

            delete:
              userDelete,
          },

          playerIdentity: {
            findUnique:
              vi.fn()
                .mockResolvedValue(
                  null,
                ),
          },

          authOtp: {
            delete:
              otpDelete,
          },

          $transaction:
            vi.fn(
              async (
                callback:
                  (
                    client:
                      typeof tx,
                  ) =>
                    Promise<unknown>,
              ) =>
                callback(
                  tx,
                ),
            ),
        };

        const mail = {
          sendVerificationOtp:
            vi.fn()
              .mockRejectedValue(
                new Error(
                  'provider unavailable',
                ),
              ),
        };

        const service =
          new AuthService(
            prisma as never,
            {} as never,
            mail as never,
          );

        await expect(
          service.register({
            fullName:
              'Test Player',
            email:
              'player@example.com',
            inGameName:
              'TESTPLAYER',
            password:
              'password1',
            confirmPassword:
              'password1',
          }),
        ).rejects.toMatchObject({
          response: {
            error: {
              code:
                'EMAIL_DELIVERY_FAILED_ACCOUNT_PENDING',
            },
          },
        });

        expect(
          otpDelete,
        ).toHaveBeenCalledWith({
          where: {
            id:
              'otp-1',
          },
        });

        expect(
          userDelete,
        ).not.toHaveBeenCalled();
      },
    );
  },
);
