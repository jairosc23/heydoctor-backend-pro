import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Alinea `consultations` con la entidad TypeORM cuando la tabla existe pero faltan columnas
 * (p. ej. esquema creado a mano o migraciones no aplicadas). Idempotente.
 */
export class ConsultationsTableSchemaSync1747500000000
  implements MigrationInterface
{
  name = 'ConsultationsTableSchemaSync1747500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $sync$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'consultations'
        ) THEN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'consultations' AND column_name = 'reason'
          ) AND NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'consultations' AND column_name = 'chief_complaint'
          ) THEN
            ALTER TABLE "consultations" RENAME COLUMN "reason" TO "chief_complaint";
          END IF;

          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'consultations' AND column_name = 'treatment'
          ) AND NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'consultations' AND column_name = 'treatment_plan'
          ) THEN
            ALTER TABLE "consultations" RENAME COLUMN "treatment" TO "treatment_plan";
          END IF;
        END IF;
      END $sync$
    `);

    await queryRunner.query(`
      ALTER TABLE "consultations" ADD COLUMN IF NOT EXISTS "patient_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "consultations" ADD COLUMN IF NOT EXISTS "clinic_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "consultations" ADD COLUMN IF NOT EXISTS "consent_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "consultations" ADD COLUMN IF NOT EXISTS "consent_version" character varying(32)
    `);
    await queryRunner.query(`
      ALTER TABLE "consultations" ADD COLUMN IF NOT EXISTS "consent_given_at" TIMESTAMPTZ
    `);
    await queryRunner.query(`
      ALTER TABLE "consultations" ADD COLUMN IF NOT EXISTS "consent_ip" character varying(64)
    `);
    await queryRunner.query(`
      ALTER TABLE "consultations" ADD COLUMN IF NOT EXISTS "consent_user_agent" text
    `);
    await queryRunner.query(`
      ALTER TABLE "consultations" ADD COLUMN IF NOT EXISTS "doctor_signature" text
    `);
    await queryRunner.query(`
      ALTER TABLE "consultations" ADD COLUMN IF NOT EXISTS "patient_signature" text
    `);
    await queryRunner.query(`
      ALTER TABLE "consultations" ADD COLUMN IF NOT EXISTS "signed_at" TIMESTAMPTZ
    `);
    await queryRunner.query(`
      ALTER TABLE "consultations" ADD COLUMN IF NOT EXISTS "doctor_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "consultations" ADD COLUMN IF NOT EXISTS "chief_complaint" text NOT NULL DEFAULT ''
    `);
    await queryRunner.query(`
      ALTER TABLE "consultations" ADD COLUMN IF NOT EXISTS "symptoms" text
    `);
    await queryRunner.query(`
      ALTER TABLE "consultations" ADD COLUMN IF NOT EXISTS "diagnosis" text
    `);
    await queryRunner.query(`
      ALTER TABLE "consultations" ADD COLUMN IF NOT EXISTS "treatment_plan" text
    `);
    await queryRunner.query(`
      ALTER TABLE "consultations" ADD COLUMN IF NOT EXISTS "notes" text
    `);
    await queryRunner.query(`
      ALTER TABLE "consultations" ADD COLUMN IF NOT EXISTS "ai_summary" text
    `);
    await queryRunner.query(`
      ALTER TABLE "consultations" ADD COLUMN IF NOT EXISTS "ai_suggested_diagnosis" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "consultations" ADD COLUMN IF NOT EXISTS "ai_improved_notes" text
    `);
    await queryRunner.query(`
      ALTER TABLE "consultations" ADD COLUMN IF NOT EXISTS "ai_generated_at" TIMESTAMPTZ
    `);
    await queryRunner.query(`
      ALTER TABLE "consultations" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
    `);
    await queryRunner.query(`
      ALTER TABLE "consultations" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
    `);

    await queryRunner.query(`
      DO $status$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'consultations_status_enum')
           AND NOT EXISTS (
             SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'consultations' AND column_name = 'status'
           ) THEN
          ALTER TABLE "consultations" ADD COLUMN "status" "consultations_status_enum" NOT NULL DEFAULT 'draft';
        END IF;
      END $status$
    `);

    await queryRunner.query(`
      DO $nn$
      BEGIN
        IF (SELECT COUNT(*) FROM "consultations" WHERE "patient_id" IS NULL OR "clinic_id" IS NULL) = 0 THEN
          ALTER TABLE "consultations" ALTER COLUMN "patient_id" SET NOT NULL;
          ALTER TABLE "consultations" ALTER COLUMN "clinic_id" SET NOT NULL;
        END IF;
        IF (SELECT COUNT(*) FROM "consultations" WHERE "doctor_id" IS NULL) = 0 THEN
          ALTER TABLE "consultations" ALTER COLUMN "doctor_id" SET NOT NULL;
        END IF;
      END $nn$
    `);

    await queryRunner.query(`
      DO $fk$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_consultations_patient'
        ) THEN
          ALTER TABLE "consultations"
            ADD CONSTRAINT "FK_consultations_patient"
            FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE;
        END IF;
      END $fk$
    `);
    await queryRunner.query(`
      DO $fk$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_consultations_clinic'
        ) THEN
          ALTER TABLE "consultations"
            ADD CONSTRAINT "FK_consultations_clinic"
            FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE;
        END IF;
      END $fk$
    `);
    await queryRunner.query(`
      DO $fk$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_consultations_consent'
        ) THEN
          ALTER TABLE "consultations"
            ADD CONSTRAINT "FK_consultations_consent"
            FOREIGN KEY ("consent_id") REFERENCES "telemedicine_consents"("id") ON DELETE SET NULL;
        END IF;
      END $fk$
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_consultations_clinic_created"
      ON "consultations" ("clinic_id", "created_at")
    `);
  }

  public async down(): Promise<void> {
    /* irreversible repair migration */
  }
}
