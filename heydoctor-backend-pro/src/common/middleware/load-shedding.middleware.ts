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

const DEFAULT_CRITICAL_PREFIXES = ['/api/auth', '/api/payku'];

function parseCriticalPrefixes(): string[] {
  const raw = process.env.LOAD_SHED_CRITICAL_PREFIXES?.trim();
  if (!raw) {
    return DEFAULT_CRITICAL_PREFIXES;
  }
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}

const criticalPathPrefixes = parseCriticalPrefixes();

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

/** Rutas críticas: no aplicar 429/503 por shedding (auth, webhooks, etc.). */
function isLoadShedCritical(url: string): boolean {
  const path = (url.split('?')[0] ?? '').toLowerCase();
  for (const p of criticalPathPrefixes) {
    if (path === p || path.startsWith(`${p}/`)) {
      return true;
    }
  }
  return false;
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
    const ip = String(req.ip ?? req.socket?.remoteAddress ?? 'unknown');

    if (isLoadShedCritical(url)) {
      this.httpLoad.recordIncoming();
      this.suspiciousTraffic.recordIpHit(ip);
      const banRetryCrit =
        this.suspiciousTraffic.getTemporaryBanRetryAfterSeconds(ip);
      if (banRetryCrit !== null) {
        res
          .status(403)
          .setHeader('Retry-After', String(banRetryCrit))
          .json({
            statusCode: 403,
            message: 'Temporarily blocked — excessive traffic',
            error: 'Forbidden',
          });
        return;
      }
      const qpsCrit = this.httpLoad.getSmoothedIncomingQps();
      this.mitigationHooks.notifyLoadPressure(qpsCrit / this.threshold);
      next();
      return;
    }

    this.httpLoad.recordIncoming();
    this.suspiciousTraffic.recordIpHit(ip);
    const banRetry = this.suspiciousTraffic.getTemporaryBanRetryAfterSeconds(ip);
    if (banRetry !== null) {
      res.status(403).setHeader('Retry-After', String(banRetry)).json({
        statusCode: 403,
        message: 'Temporarily blocked — excessive traffic',
        error: 'Forbidden',
      });
      return;
    }

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
