import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = isHttp
      ? exception.getResponse()
      : 'Internal server error';

    if (!isHttp) {
      // Log full detail server-side; never forward stack traces to the caller.
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }

    response.status(status).json({
      success: false,
      error: {
        statusCode: status,
        code: isHttp ? exception.constructor.name.replace(/Exception$/, '').toUpperCase() : 'INTERNAL_SERVER_ERROR',
        message: typeof message === 'string' ? message : (message as { message?: unknown }).message ?? message,
      },
      timestamp: new Date().toISOString(),
    });
  }
}
