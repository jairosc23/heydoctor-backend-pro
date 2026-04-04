import { MigrationInterface, QueryRunner } from 'typeorm';

export class RefreshTokensDeviceFingerprint1746300000000
  implements MigrationInterface
{
  name = 'RefreshTokensDeviceFingerprint1746300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "refresh_tokens"
      ADD COLUMN IF NOT EXISTS "user_agent_normalized" character varying(256) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "refresh_tokens"
      ADD COLUMN IF NOT EXISTS "device_hash" character varying(64) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "refresh_tokens" DROP COLUMN IF EXISTS "device_hash"
    `);
    await queryRunner.query(`
      ALTER TABLE "refresh_tokens" DROP COLUMN IF EXISTS "user_agent_normalized"
    `);
  }
}
