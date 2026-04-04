import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Índices para listado de sesiones, revoke-all, cleanup y enforceSessionLimit.
 */
export class RefreshTokensQueryIndexes1746400000000
  implements MigrationInterface
{
  name = 'RefreshTokensQueryIndexes1746400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_refresh_tokens_user_id_clinic_id"
      ON "refresh_tokens" ("user_id", "clinic_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_refresh_tokens_expires_at"
      ON "refresh_tokens" ("expires_at")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_refresh_tokens_revoked_at"
      ON "refresh_tokens" ("revoked_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_refresh_tokens_revoked_at"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_refresh_tokens_expires_at"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_refresh_tokens_user_id_clinic_id"
    `);
  }
}
