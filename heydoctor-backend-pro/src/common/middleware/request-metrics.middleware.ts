import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import type { LoggerService } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { APP_LOGGER } from '../logger/logger.tokens';
import type { AppLoggerService } from '../logger/app-logger.service';
import { HttpLoadTrackerService } from '../observability/http-load-tracker.service';
import { PrometheusService } from '../observability/prometheus.service';
import { getRequestContext } from '../request-context.storage';

/**
 * Al cerrar la respuesta (`finish`), registra duración y código HTTP con el contexto ALS
 * (requestId, path, userId enmascarado vía {@link AppLoggerService.mergeRequestMeta}).
 */
@Injectable()
export class RequestMetricsMiddleware implements NestMiddleware {
  private static readonly ROLLING_WINDOW = 200;

  private readonly log: AppLoggerService;
  private readonly rollingDurationsMs: number[] = [];

  constructor(
    @Inject(APP_LOGGER) logger: LoggerService,
    private readonly prometheus: PrometheusService,
    private readonly httpLoadTracker: HttpLoadTrackerService,
  ) {
    this.log = logger as AppLoggerService;
  }

  private pushRollingAndApproxP95(durationMs: number): number | undefined {
    this.rollingDurationsMs.push(durationMs);
    if (this.rollingDurationsMs.length > RequestMetricsMiddleware.ROLLING_WINDOW) {
      this.rollingDurationsMs.shift();
    }
    const n = this.rollingDurationsMs.length;
    if (n === 0) {
      return undefined;
    }
    const sorted = [...this.rollingDurationsMs].sort((a, b) => a - b);
    const idx = Math.min(
      n - 1,
      Math.max(0, Math.ceil(0.95 * n) - 1),
    );
    return sorted[idx];
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();
    res.on('finish', () => {
      const durationMs = Date.now() - start;
      const statusCode = res.statusCode;
      const isError = statusCode >= 400;
      let durationBucket: 'lt100' | 'lt500' | 'gte500';
      if (durationMs < 100) {
        durationBucket = 'lt100';
      } else if (durationMs < 500) {
        durationBucket = 'lt500';
      } else {
        durationBucket = 'gte500';
      }
      const rollingP95MsApprox = this.pushRollingAndApproxP95(durationMs);
      const ctx = getRequestContext();
      this.log.log('http_request', {
        statusCode,
        durationMs,
        durationBucket,
        isError,
        ...(ctx?.geoRegion ? { geoRegion: ctx.geoRegion } : {}),
        ...(rollingP95MsApprox !== undefined
          ? { rollingP95MsApprox }
          : {}),
      });
      this.httpLoadTracker.recordRequest();
      this.prometheus.observeHttpRequest(
        req.method,
        req.originalUrl ?? req.url ?? '/',
        statusCode,
        durationMs,
      );
    });
    next();
  }
}
