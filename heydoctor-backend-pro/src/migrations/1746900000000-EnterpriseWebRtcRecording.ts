import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnterpriseWebRtcRecording1746900000000 implements MigrationInterface {
  name = 'EnterpriseWebRtcRecording1746900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "webrtc_call_metrics" ADD COLUMN IF NOT EXISTS "call_id" uuid NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "webrtc_call_metrics" ADD COLUMN IF NOT EXISTS "selected_candidate_type" character varying(16) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "webrtc_call_metrics" ADD COLUMN IF NOT EXISTS "turn_region" character varying(32) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "webrtc_call_metrics" ADD COLUMN IF NOT EXISTS "ice_restart_events" integer NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "recording_sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "consultation_id" uuid NOT NULL,
        "started_by_user_id" uuid NOT NULL,
        "status" character varying(24) NOT NULL DEFAULT 'pending',
        "consent_asserted" boolean NOT NULL DEFAULT false,
        "consent_required" boolean NOT NULL DEFAULT true,
        "encryption_key_ref" text NULL,
        "storage_provider" character varying(32) NOT NULL DEFAULT 's3_compatible_stub',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_recording_sessions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_recording_sessions_consultation"
          FOREIGN KEY ("consultation_id") REFERENCES "consultations"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_recording_sessions_consultation"
      ON "recording_sessions" ("consultation_id", "status")
    `);

    await queryRunner.query(`
      CREATE TABLE "recording_access_audits" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "recording_session_id" uuid NOT NULL,
        "actor_user_id" uuid NOT NULL,
        "action" character varying(64) NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_recording_access_audits" PRIMARY KEY ("id"),
        CONSTRAINT "FK_recording_access_session"
          FOREIGN KEY ("recording_session_id") REFERENCES "recording_sessions"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_recording_access_audits_session"
      ON "recording_access_audits" ("recording_session_id", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_recording_access_audits_session"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "recording_access_audits"`);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_recording_sessions_consultation"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "recording_sessions"`);

    await queryRunner.query(`
      ALTER TABLE "webrtc_call_metrics"
      DROP COLUMN IF EXISTS "ice_restart_events",
      DROP COLUMN IF EXISTS "turn_region",
      DROP COLUMN IF EXISTS "selected_candidate_type",
      DROP COLUMN IF EXISTS "call_id"
    `);
  }
}
