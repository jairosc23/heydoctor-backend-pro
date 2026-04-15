import type { LoggerService } from '@nestjs/common';
import type { Repository, ObjectLiteral } from 'typeorm';
import type { ReadReplicaCircuitLike } from './read-replica-circuit.service';

/**
 * Ejecuta una lectura preferiendo réplica; ante fallo, reintenta en primario.
 * Si el circuit breaker está abierto, no consulta la réplica hasta el cooldown.
 */
export async function withReadReplicaFallback<TEntity extends ObjectLiteral, T>(
  readRepo: Repository<TEntity> | undefined,
  primaryRepo: Repository<TEntity>,
  run: (repo: Repository<TEntity>) => Promise<T>,
  log: LoggerService,
  context: string,
  circuit?: ReadReplicaCircuitLike,
): Promise<T> {
  const useReplica =
    Boolean(readRepo) &&
    (!circuit || circuit.shouldAttemptReplica());

  if (!useReplica) {
    return run(primaryRepo);
  }
  try {
    const out = await run(readRepo!);
    circuit?.recordReplicaSuccess();
    return out;
  } catch (e) {
    circuit?.recordReplicaFailure();
    log.warn(
      JSON.stringify({
        msg: 'read_replica_fallback',
        context,
        detail: e instanceof Error ? e.message : String(e),
      }),
    );
    return run(primaryRepo);
  }
}
