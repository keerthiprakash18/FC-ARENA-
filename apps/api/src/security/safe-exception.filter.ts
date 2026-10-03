import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class SafeExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(SafeExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    if (status >= 500) {
      // Provider/database errors may include credentials, SQL or request bodies.
      // Never serialize the exception or its cause/stack to logs or responses.
      this.logger.error(`API request failed with status ${status}`);
      response.status(status).json({
        success: false, data: null,
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Unable to complete this request right now. Please try again.' },
      });
      return;
    }
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      response.status(status).json(typeof body === 'string' ? { statusCode: status, message: body } : body);
    }
  }
}
