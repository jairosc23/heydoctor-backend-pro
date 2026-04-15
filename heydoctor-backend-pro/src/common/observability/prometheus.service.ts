import { Injectable } from '@nestjs/common';
import * as client from 'prom-client';
import { normalizePathForMetrics } from './metrics-path.util';

@Injectable()
export class PrometheusService {
  readonly register: client.Registry;
  private readonly httpDuration: client.Histogram<string>;

  constructor() {
    this.register = new client.Registry();
    client.collectDefaultMetrics({ register: this.register });
    this.httpDuration = new client.Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30],
      registers: [this.register],
    });
  }

  observeHttpRequest(
    method: string,
    pathOrUrl: string,
    statusCode: number,
    durationMs: number,
  ): void {
    const route = normalizePathForMetrics(pathOrUrl);
    this.httpDuration
      .labels(method, route || '/', String(statusCode))
      .observe(durationMs / 1000);
  }

  async renderMetrics(): Promise<string> {
    return this.register.metrics();
  }
}
