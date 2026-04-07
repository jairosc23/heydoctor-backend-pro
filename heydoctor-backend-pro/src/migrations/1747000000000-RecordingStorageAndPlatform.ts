import { MigrationInterface, QueryRunner } from 'typeorm';

export class RecordingStorageAndPlatform1747000000000
  implements MigrationInterface
{
  name = 'RecordingStorageAndPlatform1747000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "recording_sessions" ADD COLUMN IF NOT EXISTS "storage_path" text NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "recording_sessions" ADD COLUMN IF NOT EXISTS "encryption_key_id" character varying(128) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "recording_sessions" ADD COLUMN IF NOT EXISTS "ended_at" TIMESTAMPTZ NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "recording_sessions" DROP COLUMN IF EXISTS "ended_at"
    `);
    await queryRunner.query(`
      ALTER TABLE "recording_sessions" DROP COLUMN IF EXISTS "encryption_key_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "recording_sessions" DROP COLUMN IF EXISTS "storage_path"
    `);
  }
}
