import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Índice BRIN sobre `created_at` para consultas por rango temporal en tablas grandes.
 * Retención/archivado de filas sigue siendo responsabilidad operativa.
 */
export class AuditLogsCreatedAtBrin1746500000000 implements MigrationInterface {
  name = 'AuditLogsCreatedAtBrin1746500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_audit_logs_created_at_brin"
      ON "audit_logs" USING BRIN ("created_at");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_audit_logs_created_at_brin";
    `);
  }
}
