/** Nombre de conexión TypeORM para lecturas (réplica). */
export const TYPEORM_READ_CONNECTION = 'read' as const;

export function isTypeormReadReplicaConfigured(): boolean {
  return Boolean(process.env.DATABASE_READ_REPLICA_URL?.trim());
}
