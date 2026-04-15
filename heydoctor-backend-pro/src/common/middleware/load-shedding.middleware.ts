import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { HttpLoadTrackerService } from '../observability/http-load-tracker.service';

const DEFAULT_SHED_QPS = 300;

function parseThreshold(): number {
  const raw = process.env.LOAD_SHED_QPS?.trim();
  if (!raw) return DEFAULT_SHED_QPS;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_SHED_QPS;
}

/** Rutas que no deben cortarse (health, métricas). */
function isLoadShedExempt(url: string): boolean {
  const path = (url.split('?')[0] ?? '').toLowerCase();
  return (
    path === '/_health' ||
    path === '/healthz' ||
    path === '/health' ||
    path === '/metrics' ||
    path === '/api/health'
  );
}

/**
 * Bajo QPS de entrada muy alto, responde 503 para proteger el proceso (circuit breaker ligero).
 */
@Injectable()
export class LoadSheddingMiddleware implements NestMiddleware {
  private readonly threshold = parseThreshold();

  constructor(private readonly httpLoad: HttpLoadTrackerService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const url = req.originalUrl ?? req.url ?? '';
    if (isLoadShedExempt(url)) {
      next();
      return;
    }
    this.httpLoad.recordIncoming();
    if (this.httpLoad.getSmoothedIncomingQps() > this.threshold) {
      res.status(503).setHeader('Retry-After', '2').json({
        statusCode: 503,
        message: 'Service temporarily overloaded',
        error: 'Service Unavailable',
      });
      return;
    }
    next();
  }
}
