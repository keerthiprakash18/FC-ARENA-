import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import type { Response } from 'express';

// Keep actionable validation/permission messages in the envelope understood by
// both web JSON requests and multipart uploads. Unexpected failures continue to
// the application's existing safe exception filter.
@Catch(HttpException)
export class CommunityExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const status = exception.getStatus();
    const body = exception.getResponse();
    const response = host.switchToHttp().getResponse<Response>();
    if (status >= 500) {
      response
        .status(status)
        .json({
          success: false,
          data: null,
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message:
              'Unable to complete this request right now. Please try again.',
          },
        });
      return;
    }
    if (typeof body === 'object' && 'success' in body) {
      response.status(status).json(body);
      return;
    }
    const message =
      typeof body === 'string'
        ? body
        : typeof body === 'object' && 'message' in body
          ? body.message
          : 'Unable to complete this action.';
    const codes: Record<number, string> = {
      400: 'INVALID_INPUT',
      401: 'AUTH_REQUIRED',
      403: 'ACTION_NOT_ALLOWED',
      404: 'CONTENT_UNAVAILABLE',
      409: 'CONFLICT',
      413: 'IMAGE_TOO_LARGE',
      429: 'RATE_LIMITED',
    };
    response
      .status(status)
      .json({
        success: false,
        data: null,
        error: {
          code: codes[status] ?? 'REQUEST_FAILED',
          message: Array.isArray(message) ? message.join(' ') : message,
        },
      });
  }
}
