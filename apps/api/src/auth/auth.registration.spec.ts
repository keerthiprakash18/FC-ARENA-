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
  'AuthService registration without mandatory email OTP',
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
      'creates a new player account as active without sending a verification OTP',
      async () => {
        const userCreate =
          vi.fn()
            .mockResolvedValue({
              id:
                'user-1',
              fullName:
                'Test Player',
              email:
                'player@example.com',
              status:
                'ACTIVE',
            });

        const tx = {
          user: {
            create:
              userCreate,
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
        };

        const prisma = {
          user: {
            findUnique:
              vi.fn()
                .mockResolvedValue(
                  null,
                ),
          },

          playerIdentity: {
            findUnique:
              vi.fn()
                .mockResolvedValue(
                  null,
                ),
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
            vi.fn(),
        };

        const service =
          new AuthService(
            prisma as never,
            {} as never,
            mail as never,
          );

        const result =
          await service.register({
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
          });

        expect(
          userCreate,
        ).toHaveBeenCalledWith({
          data: expect.objectContaining({
            email:
              'player@example.com',
            status:
              'ACTIVE',
          }),
        });

        expect(
          mail.sendVerificationOtp,
        ).not.toHaveBeenCalled();

        expect(
          result,
        ).toMatchObject({
          success:
            true,

          data: {
            message:
              'Registration successful. Your account is ready to sign in.',

            user: {
              status:
                'ACTIVE',
            },

            player: {
              playerCode:
                'FCA-P-000001',
            },
          },
        });
      },
    );
  },
);
