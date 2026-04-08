import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Optimiza `GET /patients` (filtro por clínica + orden por fecha).
 * `consultations` ya posee `IDX_consultations_clinic_created` (`clinic_id`, `created_at`).
 */
export class PatientsClinicCreatedAtIndex1747100000000
  implements MigrationInterface
{
  name = 'PatientsClinicCreatedAtIndex1747100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_patients_clinic_created_at"
      ON "patients" ("clinic_id", "created_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_patients_clinic_created_at"`,
    );
  }
}
