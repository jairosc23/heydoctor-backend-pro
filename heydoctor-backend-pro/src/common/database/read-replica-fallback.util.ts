import type { LoggerService } from '@nestjs/common';
import type { Repository, ObjectLiteral } from 'typeorm';

/**
 * Ejecuta una lectura preferiendo réplica; ante fallo, reintenta en primario.
 */
export async function withReadReplicaFallback<TEntity extends ObjectLiteral, T>(
  readRepo: Repository<TEntity> | undefined,
  primaryRepo: Repository<TEntity>,
  run: (repo: Repository<TEntity>) => Promise<T>,
  log: LoggerService,
  context: string,
): Promise<T> {
  if (!readRepo) {
    return run(primaryRepo);
  }
  try {
    return await run(readRepo);
  } catch (e) {
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
