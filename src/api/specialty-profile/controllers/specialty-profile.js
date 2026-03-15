"use strict";

const { createCoreController } = require("@strapi/strapi").factories;
const cache = require("../../../../config/functions/redis-cache");

const TTL_SPECIALTIES = 1800; // 30 min

module.exports = createCoreController("api::specialty-profile.specialty-profile", ({ strapi }) => ({
  async find(ctx) {
    const cacheKey = `specialties:list:${JSON.stringify(ctx.query || {})}`;
    const data = await cache.getOrSetCache(cacheKey, TTL_SPECIALTIES, async () => {
      const result = await super.find(ctx);
      return result?.data !== undefined ? result : { data: result, meta: {} };
    });
    return data;
  },
}));
