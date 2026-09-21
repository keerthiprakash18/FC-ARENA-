import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  OtpMailService,
} from './mail.service.js';


describe(
  'OtpMailService',
  () => {
    const originalApiKey =
      process.env.BREVO_API_KEY;

    const originalSender =
      process.env.MAIL_FROM_EMAIL;

    const originalSenderName =
      process.env.MAIL_FROM_NAME;


    beforeEach(
      () => {
        process.env.BREVO_API_KEY =
          'test-key';

        process.env.MAIL_FROM_EMAIL =
          'noreply@example.com';

        process.env.MAIL_FROM_NAME =
          'FC ARENA';

        vi.restoreAllMocks();
      },
    );


    afterEach(
      () => {
        if (
          originalApiKey ===
          undefined
        ) {
          delete process.env
            .BREVO_API_KEY;
        } else {
          process.env.BREVO_API_KEY =
            originalApiKey;
        }

        if (
          originalSender ===
          undefined
        ) {
          delete process.env
            .MAIL_FROM_EMAIL;
        } else {
          process.env.MAIL_FROM_EMAIL =
            originalSender;
        }

        if (
          originalSenderName ===
          undefined
        ) {
          delete process.env
            .MAIL_FROM_NAME;
        } else {
          process.env.MAIL_FROM_NAME =
            originalSenderName;
        }

        vi.restoreAllMocks();
      },
    );


    it(
      'sends an OTP successfully',
      async () => {
        const fetchMock =
          vi.spyOn(
            globalThis,
            'fetch',
          )
            .mockResolvedValue(
              {
                ok: true,
                status: 201,
              } as Response,
            );

        const service =
          new OtpMailService();

        await expect(
          service.sendVerificationOtp(
            'player@example.com',
            '123456',
          ),
        ).resolves.toBeUndefined();

        expect(
          fetchMock,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );


    it(
      'retries a transient provider failure',
      async () => {
        vi.spyOn(
          globalThis,
          'fetch',
        )
          .mockResolvedValueOnce(
            {
              ok: false,
              status: 503,
              text:
                async () =>
                  'temporarily unavailable',
            } as Response,
          )
          .mockResolvedValueOnce(
            {
              ok: true,
              status: 201,
            } as Response,
          );

        const service =
          new OtpMailService();

        await expect(
          service.sendVerificationOtp(
            'player@example.com',
            '123456',
          ),
        ).resolves.toBeUndefined();

        expect(
          globalThis.fetch,
        ).toHaveBeenCalledTimes(
          2,
        );
      },
      5_000,
    );


    it(
      'does not endlessly retry a non-retryable provider response',
      async () => {
        const fetchMock =
          vi.spyOn(
            globalThis,
            'fetch',
          )
            .mockResolvedValue(
              {
                ok: false,
                status: 400,
                text:
                  async () =>
                    'invalid sender',
              } as Response,
            );

        const service =
          new OtpMailService();

        await expect(
          service.sendVerificationOtp(
            'player@example.com',
            '123456',
          ),
        ).rejects.toMatchObject(
          {
            response: {
              error: {
                code:
                  'EMAIL_DELIVERY_FAILED',
              },
            },
          },
        );

        expect(
          fetchMock,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );
  },
);
