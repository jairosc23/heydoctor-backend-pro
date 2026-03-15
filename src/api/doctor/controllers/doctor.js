"use strict";

const { createCoreController } = require("@strapi/strapi").factories;
const cache = require("../../../../config/functions/redis-cache");

const TTL_DOCTORS_LIST = 300;   // 5 min
const TTL_DOCTOR_PROFILE = 600; // 10 min

module.exports = createCoreController("api::doctor.doctor", ({ strapi }) => ({
  async find(ctx) {
    const cacheKey = `doctors:list:${JSON.stringify(ctx.query || {})}`;
    const data = await cache.getOrSetCache(cacheKey, TTL_DOCTORS_LIST, async () => {
      const result = await super.find(ctx);
      return result?.data !== undefined ? result : { data: result, meta: {} };
    });
    return data;
  },
  async findOne(ctx) {
    const { id } = ctx.params;
    const cacheKey = `doctor:profile:${id}:${JSON.stringify(ctx.query || {})}`;
    const data = await cache.getOrSetCache(cacheKey, TTL_DOCTOR_PROFILE, async () => {
      const result = await super.findOne(ctx);
      return result;
    });
    return data;
  },
}));
