import { MigrationInterface, QueryRunner } from 'typeorm';

export class ConsultationRegionColumn1748000000000
  implements MigrationInterface
{
  name = 'ConsultationRegionColumn1748000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "consultations"
      ADD COLUMN IF NOT EXISTS "region" character varying(32)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "consultations" DROP COLUMN IF EXISTS "region"`,
    );
  }
}
