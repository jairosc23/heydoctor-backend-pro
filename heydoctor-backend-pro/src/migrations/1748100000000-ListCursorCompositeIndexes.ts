import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Índices compuestos alineados con cursor `(created_at DESC, id DESC)` por clínica.
 * Sustituye índices solo `(clinic_id, created_at)` al incluir `id` como desempate estable.
 */
export class ListCursorCompositeIndexes1748100000000
  implements MigrationInterface
{
  name = 'ListCursorCompositeIndexes1748100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_patients_clinic_created_id"
      ON "patients" ("clinic_id", "created_at" DESC, "id" DESC)
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_patients_clinic_created_at"
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_consultations_clinic_created_id"
      ON "consultations" ("clinic_id", "created_at" DESC, "id" DESC)
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_consultations_clinic_created"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_patients_clinic_created_at"
      ON "patients" ("clinic_id", "created_at" DESC)
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_patients_clinic_created_id"
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_consultations_clinic_created"
      ON "consultations" ("clinic_id", "created_at")
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_consultations_clinic_created_id"
    `);
  }
}
