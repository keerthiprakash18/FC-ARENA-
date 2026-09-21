import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

const MAIL_TIMEOUT_MS =
  15_000;

const MAIL_MAX_ATTEMPTS =
  3;

const RETRYABLE_STATUS_CODES =
  new Set([
    408,
    425,
    429,
    500,
    502,
    503,
    504,
  ]);


@Injectable()
export class OtpMailService {
  async sendVerificationOtp(
    email: string,
    otp: string,
  ): Promise<void> {
    await this.sendOtp({
      email,
      otp,
      subject:
        'FC ARENA - Verify your email',
      title:
        'Verify your FC ARENA account',
      message:
        'Use this verification code to activate your FC ARENA account.',
    });
  }


  async sendPasswordResetOtp(
    email: string,
    otp: string,
  ): Promise<void> {
    await this.sendOtp({
      email,
      otp,
      subject:
        'FC ARENA - Password reset code',
      title:
        'Reset your FC ARENA password',
      message:
        'Use this verification code to reset your FC ARENA password.',
    });
  }


  private async sendOtp(input: {
    email: string;
    otp: string;
    subject: string;
    title: string;
    message: string;
  }): Promise<void> {
    const apiKey =
      process.env.BREVO_API_KEY;

    const senderEmail =
      process.env.MAIL_FROM_EMAIL;

    const senderName =
      process.env.MAIL_FROM_NAME ??
      'FC ARENA';

    if (
      !apiKey ||
      !senderEmail
    ) {
      throw new ServiceUnavailableException({
        success: false,
        data: null,
        error: {
          code:
            'MAIL_SERVICE_NOT_CONFIGURED',
          message:
            'Email delivery is not configured.',
        },
      });
    }

    let lastFailure:
      unknown = null;

    for (
      let attempt = 1;
      attempt <=
      MAIL_MAX_ATTEMPTS;
      attempt += 1
    ) {
      const controller =
        new AbortController();

      const timeout =
        setTimeout(
          () =>
            controller.abort(),
          MAIL_TIMEOUT_MS,
        );

      try {
        const response =
          await fetch(
            'https://api.brevo.com/v3/smtp/email',
            {
              method:
                'POST',

              signal:
                controller.signal,

              headers: {
                accept:
                  'application/json',

                'content-type':
                  'application/json',

                'api-key':
                  apiKey,
              },

              body:
                JSON.stringify({
                  sender: {
                    name:
                      senderName,

                    email:
                      senderEmail,
                  },

                  to: [
                    {
                      email:
                        input.email,
                    },
                  ],

                  subject:
                    input.subject,

                  textContent: [
                    input.title,
                    '',
                    input.message,
                    '',
                    `OTP: ${input.otp}`,
                    '',
                    'This code expires in 10 minutes.',
                    'If you requested another OTP, only the newest code will work.',
                    'Check Spam/Junk/Promotions if you do not see this email.',
                    'Do not share this code with anyone.',
                    '',
                    'FC ARENA',
                  ].join(
                    '\n',
                  ),

                  htmlContent: `
                    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;background:#07131f;color:#ffffff;border-radius:16px">
                      <div style="font-size:12px;letter-spacing:3px;color:#55c7ff;font-weight:700">
                        FC ARENA
                      </div>

                      <h2 style="margin:14px 0 8px">
                        ${input.title}
                      </h2>

                      <p style="color:#b8c7d4;line-height:1.6">
                        ${input.message}
                      </p>

                      <div style="margin:28px 0;padding:20px;text-align:center;background:#0d2233;border-radius:12px">
                        <div style="font-size:12px;color:#90a5b5;margin-bottom:8px">
                          YOUR OTP
                        </div>

                        <div style="font-size:34px;font-weight:800;letter-spacing:8px;color:#55c7ff">
                          ${input.otp}
                        </div>
                      </div>

                      <p style="color:#90a5b5;font-size:13px;line-height:1.6">
                        This code expires in 10 minutes.
                        If you request another OTP, only the newest code will work.
                        Check Spam, Junk or Promotions if the email is delayed.
                        Do not share this code with anyone.
                      </p>
                    </div>
                  `,
                }),
            },
          );

        if (
          response.ok
        ) {
          return;
        }

        const body =
          await response.text();

        lastFailure =
          new Error(
            `Brevo returned ${response.status}: ${body.slice(0, 500)}`,
          );

        console.error(
          'Brevo email delivery failed:',
          {
            attempt,
            status:
              response.status,
            body:
              body.slice(
                0,
                500,
              ),
          },
        );

        if (
          !RETRYABLE_STATUS_CODES.has(
            response.status,
          )
        ) {
          break;
        }
      } catch (
        error
      ) {
        lastFailure =
          error;

        console.error(
          'FC ARENA email delivery attempt failed:',
          {
            attempt,
            error,
          },
        );
      } finally {
        clearTimeout(
          timeout,
        );
      }

      if (
        attempt <
        MAIL_MAX_ATTEMPTS
      ) {
        await this.delay(
          attempt *
            1_000,
        );
      }
    }

    console.error(
      'FC ARENA email delivery exhausted retries:',
      lastFailure,
    );

    throw new ServiceUnavailableException({
      success: false,
      data: null,
      error: {
        code:
          'EMAIL_DELIVERY_FAILED',
        message:
          'Unable to send the verification email right now. Please wait a moment and use Resend OTP.',
      },
    });
  }


  private async delay(
    milliseconds: number,
  ): Promise<void> {
    await new Promise<void>(
      (resolve) =>
        setTimeout(
          resolve,
          milliseconds,
        ),
    );
  }
}
