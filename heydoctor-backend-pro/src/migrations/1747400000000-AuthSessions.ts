import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AuthSessions1747400000000 implements MigrationInterface {
  name = 'AuthSessions1747400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "auth_sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "refresh_token_id" uuid NOT NULL,
        "refresh_token_hash" character varying(64) NOT NULL,
        "user_agent" text,
        "ip" character varying(64),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "last_used_at" TIMESTAMPTZ,
        "revoked_at" TIMESTAMPTZ,
        CONSTRAINT "PK_auth_sessions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_auth_sessions_refresh_token_id" UNIQUE ("refresh_token_id"),
        CONSTRAINT "FK_auth_sessions_refresh_token" FOREIGN KEY ("refresh_token_id") REFERENCES "refresh_tokens"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_auth_sessions_user_id" ON "auth_sessions" ("user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_auth_sessions_revoked_at" ON "auth_sessions" ("revoked_at")
    `);
    await queryRunner.query(`
      INSERT INTO "auth_sessions" (
        "user_id",
        "refresh_token_id",
        "refresh_token_hash",
        "user_agent",
        "ip",
        "created_at",
        "last_used_at",
        "revoked_at"
      )
      SELECT
        "user_id",
        "id",
        "token_hash",
        "user_agent",
        "ip_address",
        "created_at",
        "last_used_at",
        "revoked_at"
      FROM "refresh_tokens"
      WHERE NOT EXISTS (
        SELECT 1 FROM "auth_sessions" s WHERE s."refresh_token_id" = "refresh_tokens"."id"
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "auth_sessions"`);
  }
}
