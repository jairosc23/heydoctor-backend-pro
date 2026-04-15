import { createHash } from 'crypto';
import { Inject, Injectable, type LoggerService } from '@nestjs/common';
import { APP_LOGGER } from '../logger/logger.tokens';

const WINDOW_SEC = 60;
const WARN_THRESHOLD = 800;
const BUCKET_PRUNE = 180;

function parseBanMs(): number {
  const raw = process.env.SUSPICIOUS_TRAFFIC_BAN_MS?.trim();
  if (!raw) return 900_000;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 10_000 ? Math.floor(n) : 900_000;
}

/**
 * Detecta IPs con frecuencia anómala (posible abuso / cred stuffing).
 */
@Injectable()
export class SuspiciousTrafficService {
  private readonly banMs = parseBanMs();
  private readonly perIpSecond = new Map<string, Map<number, number>>();
  private readonly lastWarnSec = new Map<string, number>();
  /** Fin del ban temporal por IP (epoch ms). */
  private readonly banUntilMs = new Map<string, number>();

  constructor(@Inject(APP_LOGGER) private readonly log: LoggerService) {}

  recordIpHit(ip: string): void {
    const sec = Math.floor(Date.now() / 1000);
    const key = ip.trim() || 'unknown';
    let m = this.perIpSecond.get(key);
    if (!m) {
      m = new Map();
      this.perIpSecond.set(key, m);
    }
    m.set(sec, (m.get(sec) ?? 0) + 1);
    this.pruneIp(key, m, sec);
    this.maybeWarn(key, m, sec);
  }

  private pruneIp(key: string, m: Map<number, number>, nowSec: number): void {
    if (m.size <= BUCKET_PRUNE) return;
    for (const k of m.keys()) {
      if (k < nowSec - BUCKET_PRUNE) m.delete(k);
    }
    if (m.size === 0) this.perIpSecond.delete(key);
  }

  private maybeWarn(ip: string, m: Map<number, number>, nowSec: number): void {
    let sum = 0;
    for (let i = 0; i < WINDOW_SEC; i++) {
      sum += m.get(nowSec - i) ?? 0;
    }
    if (sum < WARN_THRESHOLD) return;
    const last = this.lastWarnSec.get(ip) ?? 0;
    if (nowSec - last < 45) return;
    this.lastWarnSec.set(ip, nowSec);
    const until = Date.now() + this.banMs;
    this.banUntilMs.set(ip, until);
    this.log.warn(
      JSON.stringify({
        msg: 'security_suspicious_traffic',
        ipHash: hashIp(ip),
        windowSec: WINDOW_SEC,
        approxHits: sum,
        banMs: this.banMs,
      }),
    );
  }

  /** Ban temporal tras umbral de abuso (misma ventana que el log estructurado). */
  getTemporaryBanRetryAfterSeconds(ip: string): number | null {
    const key = ip.trim() || 'unknown';
    const until = this.banUntilMs.get(key);
    if (until === undefined) {
      return null;
    }
    const leftMs = until - Date.now();
    if (leftMs <= 0) {
      this.banUntilMs.delete(key);
      return null;
    }
    return Math.max(1, Math.ceil(leftMs / 1000));
  }
}

function hashIp(ip: string): string {
  return createHash('sha256').update(ip, 'utf8').digest('hex').slice(0, 16);
}
