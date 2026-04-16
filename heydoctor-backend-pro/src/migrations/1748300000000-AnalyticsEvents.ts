import { MigrationInterface, QueryRunner } from 'typeorm';

export class AnalyticsEvents1748300000000 implements MigrationInterface {
  name = 'AnalyticsEvents1748300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "analytics_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "event_name" character varying(64) NOT NULL,
        "path" character varying(2048),
        "user_id" uuid,
        "session_id" character varying(64) NOT NULL,
        "metadata" jsonb,
        "user_agent" character varying(512),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_analytics_events" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_analytics_events_event_created"
      ON "analytics_events" ("event_name", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_analytics_events_session_created"
      ON "analytics_events" ("session_id", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_analytics_events_session_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_analytics_events_event_created"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "analytics_events"`);
  }
}
