import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Red de seguridad idempotente: la entidad `Consultation` usa `chief_complaint` y
 * `treatment_plan`. Si la tabla sigue con `reason` / `treatment` (BD legada o migración
 * omitida), renombra antes de que TypeORM falle al leer/escribir.
 *
 * No hace nada si los nombres clínicos ya existen o si la tabla no existe.
 */
export class EnsureConsultationClinicalColumnNames1747800000000
  implements MigrationInterface
{
  name = 'EnsureConsultationClinicalColumnNames1747800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $sync$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'consultations'
        ) THEN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'consultations' AND column_name = 'reason'
          ) AND NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'consultations' AND column_name = 'chief_complaint'
          ) THEN
            ALTER TABLE "consultations" RENAME COLUMN "reason" TO "chief_complaint";
          END IF;

          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'consultations' AND column_name = 'treatment'
          ) AND NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'consultations' AND column_name = 'treatment_plan'
          ) THEN
            ALTER TABLE "consultations" RENAME COLUMN "treatment" TO "treatment_plan";
          END IF;
        END IF;
      END $sync$
    `);
  }

  public async down(): Promise<void> {
    /* irreversible safety migration */
  }
}
