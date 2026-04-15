import { Inject, Injectable, type LoggerService } from '@nestjs/common';
import { APP_LOGGER } from '../logger/logger.tokens';

export type ReadReplicaCircuitLike = {
  shouldAttemptReplica(): boolean;
  recordReplicaSuccess(): void;
  recordReplicaFailure(): void;
};

function parseCooldownMs(): number {
  const raw = process.env.READ_REPLICA_CIRCUIT_OPEN_MS?.trim();
  if (!raw) return 45_000;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1000 ? Math.floor(n) : 45_000;
}

function parseFailuresToOpen(): number {
  const raw = process.env.READ_REPLICA_CIRCUIT_FAILURES?.trim();
  if (!raw) return 2;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 2;
}

/**
 * Circuit breaker para lecturas en réplica: tras fallos consecutivos, deja de
 * consultar la réplica durante un cooldown y usa solo primario.
 */
@Injectable()
export class ReadReplicaCircuitService implements ReadReplicaCircuitLike {
  private readonly cooldownMs = parseCooldownMs();
  private readonly failuresToOpen = parseFailuresToOpen();
  private consecutiveFailures = 0;
  private openUntil = 0;

  constructor(@Inject(APP_LOGGER) private readonly log: LoggerService) {}

  shouldAttemptReplica(): boolean {
    return Date.now() >= this.openUntil;
  }

  recordReplicaSuccess(): void {
    this.consecutiveFailures = 0;
    this.openUntil = 0;
  }

  recordReplicaFailure(): void {
    this.consecutiveFailures++;
    if (this.consecutiveFailures < this.failuresToOpen) {
      return;
    }
    this.consecutiveFailures = 0;
    this.openUntil = Date.now() + this.cooldownMs;
    this.log.warn(
      JSON.stringify({
        msg: 'read_replica_circuit_open',
        cooldownMs: this.cooldownMs,
      }),
    );
  }
}
