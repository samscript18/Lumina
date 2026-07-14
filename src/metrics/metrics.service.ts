import { Injectable } from '@nestjs/common';

export type MetricName =
  | 'translation_requests_total'
  | 'cache_hits_total'
  | 'llm_calls_total'
  | 'validator_rejections_total'
  | 'validator_retries_total'
  | 'mcp_calls_total';

@Injectable()
export class MetricsService {
  private readonly counters = new Map<MetricName, number>();

  increment(name: MetricName, amount = 1): void {
    this.counters.set(name, (this.counters.get(name) ?? 0) + amount);
  }

  snapshot(): Record<MetricName, number> {
    return {
      translation_requests_total: this.counters.get('translation_requests_total') ?? 0,
      cache_hits_total: this.counters.get('cache_hits_total') ?? 0,
      llm_calls_total: this.counters.get('llm_calls_total') ?? 0,
      validator_rejections_total: this.counters.get('validator_rejections_total') ?? 0,
      validator_retries_total: this.counters.get('validator_retries_total') ?? 0,
      mcp_calls_total: this.counters.get('mcp_calls_total') ?? 0,
    };
  }
}
