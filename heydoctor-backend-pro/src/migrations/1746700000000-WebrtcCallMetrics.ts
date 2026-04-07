import { MigrationInterface, QueryRunner } from 'typeorm';

export class WebrtcCallMetrics1746700000000 implements MigrationInterface {
  name = 'WebrtcCallMetrics1746700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "webrtc_call_metrics" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "consultation_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "rtt_ms" double precision,
        "packets_lost" integer,
        "outbound_bitrate_bps" double precision,
        "jitter_seconds" double precision,
        "packet_loss_ratio" double precision,
        CONSTRAINT "PK_webrtc_call_metrics" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_webrtc_call_metrics_consultation_recorded"
      ON "webrtc_call_metrics" ("consultation_id", "recorded_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_webrtc_call_metrics_consultation_recorded"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "webrtc_call_metrics"`);
  }
}
