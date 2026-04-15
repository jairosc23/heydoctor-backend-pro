import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Listados por paciente ordenados por fecha (`patient_id`, `created_at`).
 * `clinic_id + created_at` ya existe como `IDX_consultations_clinic_created`.
 */
export class ConsultationsPatientCreatedAtIndex1747900000000
  implements MigrationInterface
{
  name = 'ConsultationsPatientCreatedAtIndex1747900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_consultations_patient_created_at"
      ON "consultations" ("patient_id", "created_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_consultations_patient_created_at"`,
    );
  }
}
