import { createHash } from 'crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { HttpLoadTrackerService } from '../observability/http-load-tracker.service';
import { getRequestContext } from '../request-context.storage';
import { MitigationHooksService } from '../resilience/mitigation-hooks.service';
import { SuspiciousTrafficService } from '../security/suspicious-traffic.service';

const DEFAULT_SHED_QPS = 300;

function parseThreshold(): number {
  const raw = process.env.LOAD_SHED_QPS?.trim();
  if (!raw) return DEFAULT_SHED_QPS;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_SHED_QPS;
}

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

function progressiveDropRoll(ip: string, requestId: string): number {
  const h = createHash('sha256')
    .update(`${ip}:${requestId}`, 'utf8')
    .digest('hex')
    .slice(0, 8);
  return parseInt(h, 16) / 0xffff_ffff;
}

/**
 * Degradación progresiva: 429 parcial bajo presión; 503 cuando QPS supera el umbral.
 */
@Injectable()
export class LoadSheddingMiddleware implements NestMiddleware {
  private readonly threshold = parseThreshold();

  constructor(
    private readonly httpLoad: HttpLoadTrackerService,
    private readonly mitigationHooks: MitigationHooksService,
    private readonly suspiciousTraffic: SuspiciousTrafficService,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const url = req.originalUrl ?? req.url ?? '';
    if (isLoadShedExempt(url)) {
      next();
      return;
    }
    this.httpLoad.recordIncoming();
    const ip = String(req.ip ?? req.socket?.remoteAddress ?? 'unknown');
    this.suspiciousTraffic.recordIpHit(ip);

    const qps = this.httpLoad.getSmoothedIncomingQps();
    const ratio = qps / this.threshold;
    this.mitigationHooks.notifyLoadPressure(ratio);

    if (ratio >= 1) {
      res.status(503).setHeader('Retry-After', '2').json({
        statusCode: 503,
        message: 'Service temporarily overloaded',
        error: 'Service Unavailable',
      });
      return;
    }

    if (ratio >= 0.55) {
      const t = (ratio - 0.55) / 0.45;
      const dropProb = t * t * 0.38;
      const rid = getRequestContext()?.requestId ?? ip;
      if (progressiveDropRoll(ip, rid) < dropProb) {
        res.status(429).setHeader('Retry-After', '1').json({
          statusCode: 429,
          message: 'Too many requests — load shedding',
          error: 'Too Many Requests',
        });
        return;
      }
    }

    next();
  }
}
