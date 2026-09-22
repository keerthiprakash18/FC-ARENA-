import bcrypt from 'bcryptjs';
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
  'AuthService mobile login compatibility',
  () => {
    beforeEach(
      () => {
        process.env.JWT_ACCESS_SECRET =
          'test-access-secret';

        process.env.JWT_REFRESH_SECRET =
          'test-refresh-secret';
      },
    );


    async function createService() {
      const passwordHash =
        await bcrypt.hash(
          'Password123',
          4,
        );

      const storedUser = {
        id:
          'user-1',

        fullName:
          'Test Player',

        email:
          'player@example.com',

        phoneNumber:
          null,

        passwordHash,

        role:
          'PLAYER',

        status:
          'ACTIVE',

        player: {
          playerCode:
            'FCA-P-000001',

          profileImageUrl:
            null,

          identity: {
            inGameName:
              'Tester',

            gameUid:
              null,

            isVerified:
              false,
          },
        },
      };

      const prisma = {
        user: {
          findUnique:
            vi.fn()
              .mockResolvedValue(
                storedUser,
              ),
        },

        playerIdentity: {
          findUnique:
            vi.fn()
              .mockResolvedValue({
                player: {
                  user:
                    storedUser,
                },
              }),
        },

        refreshSession: {
          create:
            vi.fn()
              .mockResolvedValue({
                id:
                  'session-1',
              }),
        },

        $queryRaw:
          vi.fn()
            .mockResolvedValue([
              {
                themePreference:
                  'CLASSIC_BLUE',
              },
            ]),
      };

      const jwt = {
        signAsync:
          vi.fn()
            .mockResolvedValueOnce(
              'access-token',
            )
            .mockResolvedValueOnce(
              'refresh-token',
            ),
      };

      const service =
        new AuthService(
          prisma as never,
          jwt as never,
          {} as never,
        );

      return {
        service,
        prisma,
      };
    }


    it(
      'accepts the exact stored password',
      async () => {
        const {
          service,
        } =
          await createService();

        const result =
          await service.login({
            email:
              'PLAYER@EXAMPLE.COM',

            password:
              'Password123',
          });

        expect(
          result.success,
        ).toBe(
          true,
        );

        expect(
          result.data.accessToken,
        ).toBe(
          'access-token',
        );
      },
    );


    it(
      'recovers from accidental mobile keyboard whitespace without changing the stored password',
      async () => {
        const {
          service,
        } =
          await createService();

        const result =
          await service.login({
            email:
              ' player@example.com ',

            password:
              '  Password123  ',
          });

        expect(
          result.success,
        ).toBe(
          true,
        );
      },
    );


    it(
      'accepts a unique in-game name as the login identifier',
      async () => {
        const {
          service,
          prisma,
        } =
          await createService();

        const result =
          await service.login({
            identifier:
              '  TESTER  ',

            password:
              'Password123',
          });

        expect(
          result.success,
        ).toBe(
          true,
        );

        expect(
          prisma.playerIdentity.findUnique,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              inGameNameNormalized:
                'tester',
            },
          }),
        );
      },
    );


    it(
      'removes invisible mobile copy-paste characters from an email identifier',
      async () => {
        const {
          service,
          prisma,
        } =
          await createService();

        const result =
          await service.login({
            identifier:
              '\u200BPLAYER@EXAMPLE.COM\uFEFF',

            password:
              'Password123',
          });

        expect(
          result.success,
        ).toBe(
          true,
        );

        expect(
          prisma.user.findUnique,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              email:
                'player@example.com',
            },
          }),
        );
      },
    );


    it(
      'still rejects a genuinely incorrect password',
      async () => {
        const {
          service,
        } =
          await createService();

        await expect(
          service.login({
            email:
              'player@example.com',

            password:
              'WrongPassword123',
          }),
        ).rejects.toThrow();
      },
    );
  },
);
