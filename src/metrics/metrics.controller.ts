import { Controller, Get, Header, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { MetricsService } from './metrics.service';

@UseGuards(ApiKeyGuard)
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  getMetrics() {
    return { counters: this.metrics.snapshot(), collectedAt: new Date().toISOString() };
  }

  @Get('prometheus')
  @Header('Content-Type', 'text/plain; version=0.0.4')
  prometheus(@Res() response: Response): void {
    response.send(this.metrics.prometheus());
  }
}
