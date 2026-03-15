"use strict";

/**
 * Índices para optimizar queries frecuentes.
 * Evita duplicar índices existentes (PostgreSQL crea índices en FKs por defecto).
 * Se ejecuta desde bootstrap de Strapi.
 */

async function runRaw(connection, sql) {
  if (connection?.raw) {
    await connection.raw(sql);
  } else if (connection?.query) {
    await connection.query(sql);
  }
}

async function up(strapi) {
  const conn = strapi?.db?.connection;
  if (!conn) return;

  const run = (sql) => runRaw(conn, sql);
  const log = strapi?.log?.info?.bind(strapi.log) || (() => {});

  try {
    // appointments: filtros por clinic, patient, doctor, fecha
    await run("CREATE INDEX IF NOT EXISTS idx_appointments_clinic_created ON appointments(clinic_id, created_at DESC)");
    await run("CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date ON appointments(doctor_id, date)");
    await run("CREATE INDEX IF NOT EXISTS idx_appointments_patient_created ON appointments(patient_id, created_at DESC)");
    await run("CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status)");

    // messages: por appointment
    await run("CREATE INDEX IF NOT EXISTS idx_messages_appointment_created ON messages(appointment_id, created_at DESC)");

    // clinical_records: por clinic y patient
    await run("CREATE INDEX IF NOT EXISTS idx_clinical_records_clinic_created ON clinical_records(clinic_id, created_at DESC)");
    await run("CREATE INDEX IF NOT EXISTS idx_clinical_records_patient ON clinical_records(patient_id)");

    // patients: por clinic
    await run("CREATE INDEX IF NOT EXISTS idx_patients_clinic_created ON patients(clinic_id, created_at DESC)");

    // doctors: por user (auth lookup)
    await run("CREATE INDEX IF NOT EXISTS idx_doctors_user ON doctors(user_id)");
    log("DB indexes: performance indexes created");
  } catch (err) {
    if (strapi?.log) strapi.log.warn("DB indexes migration:", err?.message);
    // No lanzar: índices son optimización, no bloquean arranque
  }
}

module.exports = { up };
