import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  AuthController,
} from './auth.controller.js';

describe(
  'AuthController refresh cookie',
  () => {
    const originalNodeEnv =
      process.env.NODE_ENV;

    beforeEach(
      () => {
        process.env.NODE_ENV =
          'production';
      },
    );

    afterEach(
      () => {
        process.env.NODE_ENV =
          originalNodeEnv;
      },
    );

    it(
      'sets a strict production refresh cookie without exposing the refresh token',
      async () => {
        const authService = {
          login:
            vi.fn()
              .mockResolvedValue({
                success:
                  true,

                data: {
                  accessToken:
                    'access-token',

                  refreshToken:
                    'refresh-token',

                  expiresIn:
                    900,

                  user: {
                    id:
                      'user-1',
                  },
                },

                error:
                  null,
              }),
        };

        const rateLimit = {
          consume:
            vi.fn()
              .mockResolvedValue(
                undefined,
              ),

          clear:
            vi.fn()
              .mockResolvedValue(
                undefined,
              ),

          recordAttempt:
            vi.fn()
              .mockResolvedValue(
                undefined,
              ),
        };

        const cookie =
          vi.fn();

        const controller =
          new AuthController(
            authService as never,
            rateLimit as never,
          );

        const result =
          await controller.login(
            {
              headers: {},
              ip:
                '127.0.0.1',
              socket: {
                remoteAddress:
                  '127.0.0.1',
              },
            } as never,

            {
              email:
                'player@example.com',

              password:
                'password1',
            },

            {
              cookie,
            } as never,
          );

        expect(
          rateLimit
            .consume,
        ).toHaveBeenCalled();

        expect(
          cookie,
        ).toHaveBeenCalledWith(
          'fc_arena_refresh_token',
          'refresh-token',
          {
            httpOnly:
              true,

            secure:
              true,

            sameSite:
              'strict',

            path:
              '/api/auth',

            maxAge:
              7 *
              24 *
              60 *
              60 *
              1000,
          },
        );

        expect(
          result.data,
        ).toEqual({
          accessToken:
            'access-token',

          expiresIn:
            900,

          user: {
            id:
              'user-1',
          },
        });
      },
    );
  },
);
