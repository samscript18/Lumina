import { Controller, Get, UseGuards } from '@nestjs/common';
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
}
