import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import type { LoggerService } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { APP_LOGGER } from '../logger/logger.tokens';
import type { AppLoggerService } from '../logger/app-logger.service';

/**
 * Al cerrar la respuesta (`finish`), registra duración y código HTTP con el contexto ALS
 * (requestId, path, userId enmascarado vía {@link AppLoggerService.mergeRequestMeta}).
 */
@Injectable()
export class RequestMetricsMiddleware implements NestMiddleware {
  private readonly log: AppLoggerService;

  constructor(@Inject(APP_LOGGER) logger: LoggerService) {
    this.log = logger as AppLoggerService;
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
      this.log.log('http_request', {
        statusCode,
        durationMs,
        durationBucket,
        isError,
      });
    });
    next();
  }
}
