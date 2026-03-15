"use strict";

/**
 * Rate limiting mejorado con Redis.
 * auth → 20 req/min, consultation → 40 req/min, general API → 100 req/min.
 * Fallback a memoria cuando REDIS_URL no está definido.
 */
const WINDOW_SEC = 60;

const AUTH_PATHS = ["/api/auth/local", "/api/custom-auth/login", "/api/custom-auth/register"];
const CONSULTATION_PATHS = ["/api/consultation", "/api/appointments", "/api/messages"];
const AUTH_LIMIT = 20;
const CONSULTATION_LIMIT = 40;
const GENERAL_LIMIT = 100;

// Paths que no aplican rate limit general (health, static)
const SKIP_PATHS = ["/_health", "/uploads", "/admin"];

function getClientIp(ctx) {
  return (
    ctx.request.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    ctx.request.headers["x-real-ip"] ||
    ctx.request.ip ||
    "unknown"
  );
}

function createMemoryRateLimiter(limit, keyPrefix) {
  const { RateLimiterMemory } = require("rate-limiter-flexible");
  return new RateLimiterMemory({
    keyPrefix: keyPrefix || "rl",
    points: limit,
    duration: WINDOW_SEC,
  });
}

function createRedisRateLimiter(redis, limit, keyPrefix) {
  const { RateLimiterRedis } = require("rate-limiter-flexible");
  return new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: keyPrefix || "rl",
    points: limit,
    duration: WINDOW_SEC,
  });
}

function isRateLimitExceeded(err) {
  return err?.remainingPoints === 0 || err?.msBeforeNext !== undefined;
}

function getLimitForPath(path) {
  if (AUTH_PATHS.some((p) => path.startsWith(p))) return { limit: AUTH_LIMIT, key: "auth" };
  if (CONSULTATION_PATHS.some((p) => path.startsWith(p))) return { limit: CONSULTATION_LIMIT, key: "consultation" };
  return { limit: GENERAL_LIMIT, key: "general" };
}

module.exports = (config, { strapi }) => {
  let limiters = {};
  let useRedis = false;

  function ensureLimiters() {
    if (Object.keys(limiters).length > 0) return;

    const redis = (() => {
      try {
        const { getClient } = require("../../config/functions/redis-cache");
        return getClient();
      } catch {
        return null;
      }
    })();

    const create = redis
      ? (limit, prefix) => createRedisRateLimiter(redis, limit, prefix)
      : (limit, prefix) => createMemoryRateLimiter(limit, prefix);

    if (redis) useRedis = true;

    limiters.auth = create(AUTH_LIMIT, "rl:auth");
    limiters.consultation = create(CONSULTATION_LIMIT, "rl:consultation");
    limiters.general = create(GENERAL_LIMIT, "rl:general");
  }

  return async (ctx, next) => {
    const path = ctx.request.path;
    if (SKIP_PATHS.some((p) => path.startsWith(p))) return next();

    const { limit, key } = getLimitForPath(path);
    ensureLimiters();
    const limiter = limiters[key];
    const ip = getClientIp(ctx);
    const rlKey = `${key}:${ip}`;

    try {
      const result = await limiter.consume(rlKey);
      ctx.set("X-RateLimit-Limit", String(limit));
      ctx.set("X-RateLimit-Remaining", String(Math.max(0, result.remainingPoints ?? 0)));
      return next();
    } catch (err) {
      if (isRateLimitExceeded(err)) {
        const retryAfter = err?.msBeforeNext ? Math.ceil(err.msBeforeNext / 1000) : 60;
        ctx.set("Retry-After", String(retryAfter));
        return ctx.throw(429, "Demasiadas solicitudes. Intenta de nuevo más tarde.");
      }
      if (strapi?.log) strapi.log.warn("rate-limit error:", err?.message);
      return next();
    }
  };
};
