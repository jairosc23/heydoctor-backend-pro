import { MigrationInterface, QueryRunner } from 'typeorm';

export class RefreshTokensAddClinicId1746200000000
  implements MigrationInterface
{
  name = 'RefreshTokensAddClinicId1746200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "refresh_tokens"
      ADD COLUMN IF NOT EXISTS "clinic_id" uuid NULL
    `);
    await queryRunner.query(`
      UPDATE "refresh_tokens" rt
      SET "clinic_id" = u.clinic_id
      FROM "users" u
      WHERE rt.user_id = u.id AND rt.clinic_id IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_refresh_tokens_clinic_id"
      ON "refresh_tokens" ("clinic_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_refresh_tokens_clinic_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "refresh_tokens" DROP COLUMN IF EXISTS "clinic_id"
    `);
  }
}
