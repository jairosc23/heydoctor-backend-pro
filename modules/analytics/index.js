"use strict";

/**
 * Módulo de analytics - data warehouse con ClickHouse.
 * Si CLICKHOUSE_URL no está configurado, analytics desactivado.
 */
const CLICKHOUSE_URL = process.env.CLICKHOUSE_URL;
const CLICKHOUSE_DATABASE = process.env.CLICKHOUSE_DATABASE || "heydoctor";

let client = null;
let queue = null;

function isEnabled() {
  return !!CLICKHOUSE_URL;
}

function getClient() {
  if (!isEnabled()) return null;
  if (client) return client;
  try {
    const { createClient } = require("@clickhouse/client");
    client = createClient({
      url: CLICKHOUSE_URL,
      database: CLICKHOUSE_DATABASE,
    });
    return client;
  } catch (err) {
    if (global.strapi?.log) global.strapi.log.warn("Analytics: client init failed", err?.message);
    return null;
  }
}

/**
 * Trackea un evento genérico.
 * Solo encola si CLICKHOUSE_URL está configurado.
 */
function trackEvent(eventType, { clinicId, userId, entityId, metadata = {} } = {}) {
  if (!isEnabled()) return;
  const { enqueueAnalytics } = require("../jobs/queues");
  enqueueAnalytics({
    event_type: eventType,
    clinic_id: clinicId ?? null,
    user_id: userId ?? null,
    entity_id: entityId ?? null,
    timestamp: new Date().toISOString(),
    metadata,
  });
}

/**
 * Trackea evento de consulta.
 */
function trackConsultation(eventType, { consultationId, appointmentId, clinicId, doctorId, patientId, ...metadata } = {}) {
  trackEvent(eventType, {
    clinicId,
    userId: doctorId ?? patientId,
    entityId: consultationId ?? appointmentId,
    metadata: { consultationId, appointmentId, doctorId, patientId, ...metadata },
  });
}

/**
 * Trackea evento de cita.
 */
function trackAppointment(eventType, { appointmentId, clinicId, patientId, doctorId, ...metadata } = {}) {
  trackEvent(eventType, {
    clinicId,
    userId: doctorId ?? patientId,
    entityId: appointmentId,
    metadata: { appointmentId, patientId, doctorId, ...metadata },
  });
}

/**
 * Trackea búsqueda.
 */
function trackSearch({ clinicId, userId, query, type, resultCount, source } = {}) {
  trackEvent("search_performed", {
    clinicId,
    userId,
    entityId: null,
    metadata: { query, type, resultCount, source },
  });
}

/**
 * Trackea login.
 */
function trackLogin({ userId, clinicId, success } = {}) {
  trackEvent("login", {
    clinicId,
    userId,
    entityId: null,
    metadata: { success: !!success },
  });
}

module.exports = {
  isEnabled,
  getClient,
  trackEvent,
  trackConsultation,
  trackAppointment,
  trackSearch,
  trackLogin,
};
