import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import nodemailer, {
  type Transporter,
} from 'nodemailer';

@Injectable()
export class OtpMailService {
  private transporter: Transporter | null = null;

  async sendVerificationOtp(
    email: string,
    otp: string,
  ): Promise<void> {
    await this.sendOtp({
      email,
      otp,
      subject: 'FC ARENA - Verify your email',
      title: 'Verify your FC ARENA account',
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
      subject: 'FC ARENA - Password reset code',
      title: 'Reset your FC ARENA password',
      message:
        'Use this verification code to reset your FC ARENA password.',
    });
  }

  private getTransporter(): Transporter {
    if (this.transporter) {
      return this.transporter;
    }

    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT ?? 465);
    const secure =
      (process.env.SMTP_SECURE ?? 'true').toLowerCase() === 'true';
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
      throw new ServiceUnavailableException({
        success: false,
        data: null,
        error: {
          code: 'MAIL_SERVICE_NOT_CONFIGURED',
          message:
            'Email delivery is not configured on the server.',
        },
      });
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });

    return this.transporter;
  }

  private async sendOtp(input: {
    email: string;
    otp: string;
    subject: string;
    title: string;
    message: string;
  }): Promise<void> {
    const from =
      process.env.MAIL_FROM ??
      process.env.SMTP_USER;

    if (!from) {
      throw new ServiceUnavailableException({
        success: false,
        data: null,
        error: {
          code: 'MAIL_FROM_NOT_CONFIGURED',
          message:
            'Email sender is not configured on the server.',
        },
      });
    }

    try {
      await this.getTransporter().sendMail({
        from,
        to: input.email,
        subject: input.subject,

        text: [
          input.title,
          '',
          input.message,
          '',
          `OTP: ${input.otp}`,
          '',
          'This code expires in 5 minutes.',
          'Do not share this code with anyone.',
          '',
          'FC ARENA',
        ].join('\n'),

        html: `
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

            <p style="color:#90a5b5;font-size:13px">
              This code expires in 5 minutes.
              Do not share this code with anyone.
            </p>
          </div>
        `,
      });
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      console.error(
        'FC ARENA email delivery failed:',
        error,
      );

      throw new ServiceUnavailableException({
        success: false,
        data: null,
        error: {
          code: 'EMAIL_DELIVERY_FAILED',
          message:
            'Unable to send the verification email. Please try again.',
        },
      });
    }
  }
}