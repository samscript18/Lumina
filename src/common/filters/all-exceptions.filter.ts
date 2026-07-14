import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const isHttp = exception instanceof HttpException;
    const parserStatus = this.parserStatus(exception);
    const status = isHttp ? exception.getStatus() : parserStatus ?? HttpStatus.INTERNAL_SERVER_ERROR;
    const message = isHttp ? exception.getResponse()
      : status === HttpStatus.PAYLOAD_TOO_LARGE ? 'Request payload is too large'
      : status === HttpStatus.BAD_REQUEST ? 'Malformed JSON request body'
      : 'Internal server error';

    if (!isHttp && !parserStatus) {
      // Log full detail server-side; never forward stack traces to the caller.
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }

    response.status(status).json({
      success: false,
      error: {
        statusCode: status,
        code: isHttp ? exception.constructor.name.replace(/Exception$/, '').toUpperCase()
          : status === HttpStatus.PAYLOAD_TOO_LARGE ? 'PAYLOAD_TOO_LARGE'
          : status === HttpStatus.BAD_REQUEST ? 'BAD_REQUEST'
          : 'INTERNAL_SERVER_ERROR',
        message: typeof message === 'string' ? message : (message as { message?: unknown }).message ?? message,
      },
      timestamp: new Date().toISOString(),
    });
  }

  private parserStatus(exception: unknown): number | undefined {
    if (!exception || typeof exception !== 'object') return undefined;
    const candidate = exception as { status?: unknown; statusCode?: unknown; type?: unknown };
    const raw = candidate.status ?? candidate.statusCode;
    if (raw === HttpStatus.PAYLOAD_TOO_LARGE || candidate.type === 'entity.too.large') {
      return HttpStatus.PAYLOAD_TOO_LARGE;
    }
    if (raw === HttpStatus.BAD_REQUEST || candidate.type === 'entity.parse.failed') {
      return HttpStatus.BAD_REQUEST;
    }
    return undefined;
  }
}
