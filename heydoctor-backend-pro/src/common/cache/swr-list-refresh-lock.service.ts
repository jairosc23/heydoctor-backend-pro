import { createHash } from 'crypto';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

const LOCK_TTL_MS = 5000;
const LOCK_PREFIX = 'hd:swr:lock:';

/**
 * Dedupe de revalidación SWR entre réplicas: Redis `SET key NX PX 5000`.
 * Sin `REDIS_URL`, fallback en memoria (una sola instancia).
 */
@Injectable()
export class SwrListRefreshLockService implements OnModuleDestroy {
  private readonly redis: Redis | null;
  private readonly localInflight = new Set<string>();

  constructor() {
    const url = process.env.REDIS_URL?.trim();
    this.redis = url
      ? new Redis(url, { maxRetriesPerRequest: null })
      : null;
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis?.quit().catch(() => undefined);
  }

  /**
   * Ejecuta `revalidate` en segundo plano si se adquiere el candado distribuido.
   */
  scheduleRefresh(dedupeKey: string, revalidate: () => Promise<void>): void {
    void this.runWithLock(dedupeKey, revalidate);
  }

  private async runWithLock(
    dedupeKey: string,
    revalidate: () => Promise<void>,
  ): Promise<void> {
    const acquired = await this.tryAcquire(dedupeKey);
    if (!acquired) return;
    try {
      await revalidate();
    } catch {
      /* noop */
    } finally {
      if (!this.redis) {
        this.localInflight.delete(dedupeKey);
      }
    }
  }

  private async tryAcquire(dedupeKey: string): Promise<boolean> {
    if (this.redis) {
      const lockKey =
        LOCK_PREFIX +
        createHash('sha256').update(dedupeKey, 'utf8').digest('hex');
      const ok = await this.redis.set(lockKey, '1', 'PX', LOCK_TTL_MS, 'NX');
      return ok === 'OK';
    }
    if (this.localInflight.has(dedupeKey)) return false;
    this.localInflight.add(dedupeKey);
    return true;
  }
}
