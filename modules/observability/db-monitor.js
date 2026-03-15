"use strict";

const observability = require("./index");

const SLOW_QUERY_MS = parseInt(process.env.SLOW_QUERY_THRESHOLD_MS || "500", 10);

/**
 * Registra listener para queries lentas en Knex.
 * Log estructurado: { type: "slow_query", table, duration_ms }
 * No registra datos sensibles.
 */
function registerSlowQueryMonitor(strapi) {
  try {
    const conn = strapi?.db?.connection;
    const target = conn?.client ?? conn;
    if (!target || typeof target.on !== "function") return;

    const queryTimes = new Map();

    target.on("query", (query) => {
      const uid = query.__knexQueryUid ?? query.__knexQueryId ?? Date.now() + Math.random();
      queryTimes.set(uid, Date.now());
    });

    target.on("query-response", (_response, query) => {
      const uid = query?.__knexQueryUid ?? query?.__knexQueryId;
      if (!uid) return;
      const start = queryTimes.get(uid);
      queryTimes.delete(uid);
      if (start == null) return;
      const durationMs = Date.now() - start;
      if (durationMs < SLOW_QUERY_MS) return;

      const table = extractTableFromQuery(query);
      observability.log("warn", "slow_query", {
        type: "slow_query",
        table: table || "unknown",
        duration_ms: durationMs,
      });
    });

    target.on("query-error", (_err, query) => {
      const uid = query?.__knexQueryUid ?? query?.__knexQueryId;
      if (uid) queryTimes.delete(uid);
    });

    strapi?.log?.info?.("DB monitor: slow query logging enabled (threshold " + SLOW_QUERY_MS + "ms)");
  } catch (_) {
    // Knex event API puede variar; no bloquear arranque
  }
}

function extractTableFromQuery(query) {
  if (!query) return null;
  const sql = (query.sql || query.toString || String)().toLowerCase();
  const fromMatch = sql.match(/\bfrom\s+["']?(\w+)["']?/);
  if (fromMatch) return fromMatch[1];
  const intoMatch = sql.match(/\binto\s+["']?(\w+)["']?/);
  if (intoMatch) return intoMatch[1];
  const updateMatch = sql.match(/\bupdate\s+["']?(\w+)["']?/);
  if (updateMatch) return updateMatch[1];
  return null;
}

module.exports = { registerSlowQueryMonitor, SLOW_QUERY_MS };
