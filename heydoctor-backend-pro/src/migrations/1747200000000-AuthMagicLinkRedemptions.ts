import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AuthMagicLinkRedemptions1747200000000 implements MigrationInterface {
  name = 'AuthMagicLinkRedemptions1747200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "auth_magic_link_redemptions" (
        "redemption_key" character varying(160) NOT NULL,
        "redeemed_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_auth_magic_link_redemptions" PRIMARY KEY ("redemption_key")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_auth_magic_link_redemptions_redeemed_at"
      ON "auth_magic_link_redemptions" ("redeemed_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_auth_magic_link_redemptions_redeemed_at"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "auth_magic_link_redemptions"`);
  }
}
