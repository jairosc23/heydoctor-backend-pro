"use strict";

/**
 * Rate limiting middleware para endpoints sensibles.
 * Usa almacenamiento en memoria. Para múltiples instancias, considerar Redis.
 */
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minuto
const RATE_LIMIT_MAX = 30; // requests por ventana
const RATE_LIMITED_PATHS = [
  "/api/doctor-applications",
  "/api/auth/local",
  "/api/custom-auth/login",
  "/api/custom-auth/register",
  "/api/payment-webhooks",
];
// GET requests rate limited (mayor límite: videollamadas pueden requerir varias fetches)
const GET_RATE_LIMITED_PATHS = ["/api/webrtc/ice-servers"];
const GET_RATE_LIMIT_MAX = 60;

const store = new Map(); // ip -> { count, resetAt }

function getClientIp(ctx) {
  return (
    ctx.request.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    ctx.request.headers["x-real-ip"] ||
    ctx.request.ip ||
    "unknown"
  );
}

function cleanup() {
  const now = Date.now();
  for (const [key, val] of store.entries()) {
    if (val.resetAt < now) store.delete(key);
  }
}

module.exports = (config, { strapi }) => {
  setInterval(cleanup, 60 * 1000);

  return async (ctx, next) => {
    const path = ctx.request.path;
    const isGetLimited = ctx.request.method === "GET" && GET_RATE_LIMITED_PATHS.some((p) => path.startsWith(p));
    const isPostLimited = RATE_LIMITED_PATHS.some((p) => path.startsWith(p)) && ctx.request.method !== "GET";

    if (!isGetLimited && !isPostLimited) {
      return next();
    }

    const ip = getClientIp(ctx);
    const now = Date.now();
    const limit = isGetLimited ? GET_RATE_LIMIT_MAX : RATE_LIMIT_MAX;
    const storeKey = isGetLimited ? `get:${ip}` : ip;
    let entry = store.get(storeKey);

    if (!entry || entry.resetAt < now) {
      entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
      store.set(storeKey, entry);
    }

    entry.count += 1;

    if (entry.count > limit) {
      ctx.set("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      return ctx.throw(429, "Demasiadas solicitudes. Intenta de nuevo más tarde.");
    }

    ctx.set("X-RateLimit-Limit", String(limit));
    ctx.set("X-RateLimit-Remaining", String(Math.max(0, limit - entry.count)));
    return next();
  };
};
