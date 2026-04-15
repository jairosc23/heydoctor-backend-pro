import { Injectable } from '@nestjs/common';
import {
  TYPEORM_READ_CONNECTION,
  isTypeormReadReplicaConfigured,
} from './typeorm-read-replica';

export type ReadReplicaRoutingMode = 'primary_only' | 'replica_active';

/**
 * Réplica de lectura vía segunda conexión TypeORM `{@link TYPEORM_READ_CONNECTION}`.
 * Escrituras y migraciones siguen en la conexión `default`.
 */
@Injectable()
export class DatabaseRoutingService {
  readonly replicaUrl: string | undefined = process.env.DATABASE_READ_REPLICA_URL?.trim();

  readonly mode: ReadReplicaRoutingMode = isTypeormReadReplicaConfigured()
    ? 'replica_active'
    : 'primary_only';

  readonly readConnectionName = TYPEORM_READ_CONNECTION;

  isReadReplicaActive(): boolean {
    return isTypeormReadReplicaConfigured();
  }
}
