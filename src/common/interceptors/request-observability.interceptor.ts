import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { Observable, finalize } from 'rxjs';
import { MetricsService } from '../../metrics/metrics.service';
import { AuthenticatedRequest } from '../guards/api-key.guard';

@Injectable()
export class RequestObservabilityInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestObservabilityInterceptor.name);
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request & AuthenticatedRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    const requestId = typeof request.headers['x-request-id'] === 'string' ? request.headers['x-request-id'] : randomUUID();
    response.setHeader('X-Request-Id', requestId);
    const started = process.hrtime.bigint();
    return next.handle().pipe(finalize(() => {
      const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
      this.metrics.observeHttp(durationMs);
      this.logger.log(JSON.stringify({ requestId, method: request.method, path: request.path, statusCode: response.statusCode, durationMs: Number(durationMs.toFixed(2)), apiConsumer: request.luminaCredential?.name }));
    }));
  }
}
