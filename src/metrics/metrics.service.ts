import { Injectable } from '@nestjs/common';

export type MetricName =
  | 'translation_requests_total'
  | 'cache_hits_total'
  | 'llm_calls_total'
  | 'validator_rejections_total'
  | 'validator_retries_total'
  | 'mcp_calls_total'
  | 'github_webhooks_total'
  | 'github_pull_requests_total';

@Injectable()
export class MetricsService {
  private readonly counters = new Map<MetricName, number>();
  private httpDurationCount = 0;
  private httpDurationSumMs = 0;

  increment(name: MetricName, amount = 1): void {
    this.counters.set(name, (this.counters.get(name) ?? 0) + amount);
  }

  observeHttp(durationMs: number): void {
    this.httpDurationCount += 1;
    this.httpDurationSumMs += durationMs;
  }

  snapshot(): Record<MetricName, number> {
    return {
      translation_requests_total: this.counters.get('translation_requests_total') ?? 0,
      cache_hits_total: this.counters.get('cache_hits_total') ?? 0,
      llm_calls_total: this.counters.get('llm_calls_total') ?? 0,
      validator_rejections_total: this.counters.get('validator_rejections_total') ?? 0,
      validator_retries_total: this.counters.get('validator_retries_total') ?? 0,
      mcp_calls_total: this.counters.get('mcp_calls_total') ?? 0,
      github_webhooks_total: this.counters.get('github_webhooks_total') ?? 0,
      github_pull_requests_total: this.counters.get('github_pull_requests_total') ?? 0,
    };
  }

  prometheus(): string {
    const counters = this.snapshot();
    return [
      ...Object.entries(counters).flatMap(([name, value]) => [`# TYPE lumina_${name} counter`, `lumina_${name} ${value}`]),
      '# TYPE lumina_http_request_duration_ms summary',
      `lumina_http_request_duration_ms_count ${this.httpDurationCount}`,
      `lumina_http_request_duration_ms_sum ${this.httpDurationSumMs}`,
      '',
    ].join('\n');
  }
}
