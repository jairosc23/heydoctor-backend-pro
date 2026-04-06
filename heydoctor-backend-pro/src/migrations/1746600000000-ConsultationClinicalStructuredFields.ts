import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Modelo clínico estructurado: motivo → chief_complaint, tratamiento → treatment_plan, síntomas nuevos.
 */
export class ConsultationClinicalStructuredFields1746600000000
  implements MigrationInterface
{
  name = 'ConsultationClinicalStructuredFields1746600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "consultations" RENAME COLUMN "reason" TO "chief_complaint"
    `);
    await queryRunner.query(`
      ALTER TABLE "consultations" RENAME COLUMN "treatment" TO "treatment_plan"
    `);
    await queryRunner.query(`
      ALTER TABLE "consultations" ADD COLUMN "symptoms" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "consultations" DROP COLUMN "symptoms"
    `);
    await queryRunner.query(`
      ALTER TABLE "consultations" RENAME COLUMN "treatment_plan" TO "treatment"
    `);
    await queryRunner.query(`
      ALTER TABLE "consultations" RENAME COLUMN "chief_complaint" TO "reason"
    `);
  }
}
