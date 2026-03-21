import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds Strapi-aligned fields: doctorId, patientId, clinicId. */
export class DiagnosisStrapiFieldsMigration1732061100000
  implements MigrationInterface
{
  name = 'DiagnosisStrapiFieldsMigration1732061100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('diagnostics');
    if (!table) return;

    const colsToAdd = [
      { name: 'doctorId', type: 'uuid', nullable: true },
      { name: 'patientId', type: 'uuid', nullable: true },
      { name: 'clinicId', type: 'uuid', nullable: true },
    ];

    for (const col of colsToAdd) {
      const exists = table.columns.find((c) => c.name === col.name);
      if (!exists) {
        await queryRunner.query(
          `ALTER TABLE "diagnostics" ADD COLUMN "${col.name}" ${col.type} NULL`,
        );
      }
    }

    const refreshedTable = await queryRunner.getTable('diagnostics');
    if (refreshedTable?.columns.find((c) => c.name === 'doctorId')) {
      try {
        await queryRunner.query(`
          ALTER TABLE "diagnostics"
          ADD CONSTRAINT "FK_diagnostics_doctor"
          FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE SET NULL
        `);
      } catch {
        /* FK may already exist */
      }
    }
    if (refreshedTable?.columns.find((c) => c.name === 'patientId')) {
      try {
        await queryRunner.query(`
          ALTER TABLE "diagnostics"
          ADD CONSTRAINT "FK_diagnostics_patient"
          FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL
        `);
      } catch {
        /* FK may already exist */
      }
    }
    if (refreshedTable?.columns.find((c) => c.name === 'clinicId')) {
      try {
        await queryRunner.query(`
          ALTER TABLE "diagnostics"
          ADD CONSTRAINT "FK_diagnostics_clinic"
          FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE SET NULL
        `);
      } catch {
        /* FK may already exist */
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "diagnostics" DROP CONSTRAINT IF EXISTS "FK_diagnostics_doctor"`,
    );
    await queryRunner.query(
      `ALTER TABLE "diagnostics" DROP CONSTRAINT IF EXISTS "FK_diagnostics_patient"`,
    );
    await queryRunner.query(
      `ALTER TABLE "diagnostics" DROP CONSTRAINT IF EXISTS "FK_diagnostics_clinic"`,
    );
    await queryRunner.query(
      `ALTER TABLE "diagnostics" DROP COLUMN IF EXISTS "doctorId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "diagnostics" DROP COLUMN IF EXISTS "patientId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "diagnostics" DROP COLUMN IF EXISTS "clinicId"`,
    );
  }
}
