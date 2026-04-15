import { Injectable } from '@nestjs/common';

export type ReadReplicaRoutingMode = 'primary_only' | 'replica_configured';

/**
 * Punto de extensión para lecturas en réplica (sin activar segundo DataSource aún).
 * Cuando exista `DATABASE_READ_REPLICA_URL`, el dominio puede usar
 * `getReadConnectionHint()` para elegir estrategia en repositorios dedicados.
 */
@Injectable()
export class DatabaseRoutingService {
  readonly replicaUrl: string | undefined = process.env.DATABASE_READ_REPLICA_URL?.trim();

  readonly mode: ReadReplicaRoutingMode = this.replicaUrl
    ? 'replica_configured'
    : 'primary_only';

  /** Indica dónde enrutar lecturas hasta que exista DataSource de réplica. */
  getReadConnectionHint(): 'primary' | 'replica_pending' {
    return this.replicaUrl ? 'replica_pending' : 'primary';
  }
}
