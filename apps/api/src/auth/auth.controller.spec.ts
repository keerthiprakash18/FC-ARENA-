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
      'sets the production refresh cookie for same-origin mobile-safe sessions',
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

        const cookie =
          vi.fn();

        const controller =
          new AuthController(
            authService as never,
          );

        const result =
          await controller.login(
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
              'lax',

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
