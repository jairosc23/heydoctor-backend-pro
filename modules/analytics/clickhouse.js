"use strict";

const analytics = require("./index");

const TABLE_NAME = "events";

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
  event_type String,
  clinic_id Nullable(UInt64),
  user_id Nullable(UInt64),
  entity_id Nullable(UInt64),
  timestamp DateTime64(3),
  metadata String
) ENGINE = MergeTree()
ORDER BY (clinic_id, timestamp)
`;

async function ensureTable() {
  const c = analytics.getClient();
  if (!c) return;
  try {
    await c.command({ query: CREATE_TABLE_SQL });
  } catch (err) {
    if (global.strapi?.log) global.strapi.log.warn("Analytics: create table failed", err?.message);
  }
}

async function insertEvent(event) {
  const c = analytics.getClient();
  if (!c) return;

  const { event_type, clinic_id, user_id, entity_id, timestamp, metadata } = event;
  const metadataStr = typeof metadata === "string" ? metadata : JSON.stringify(metadata || {});
  const row = {
    event_type: event_type || "",
    clinic_id: clinic_id != null ? Number(clinic_id) : null,
    user_id: user_id != null ? Number(user_id) : null,
    entity_id: entity_id != null ? Number(entity_id) : null,
    timestamp: timestamp || new Date().toISOString(),
    metadata: metadataStr,
  };

  try {
    await c.insert({
      table: TABLE_NAME,
      values: [row],
      format: "JSONEachRow",
    });
  } catch (err) {
    if (global.strapi?.log) global.strapi.log.error("Analytics: insert failed", err?.message);
    throw err;
  }
}

module.exports = { ensureTable, insertEvent, TABLE_NAME };
