'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const { withClinicFilter, ensureClinicAccess } = require('../../../utils/tenant-scope');
const cache = require('../../../../config/functions/redis-cache');

const TTL_APPOINTMENTS_RECENT = 120; // 2 min para consultas recientes

module.exports = createCoreController('api::appointment.appointment', ({ strapi }) => ({
  async find(ctx) {
    ctx.query = ctx.query || {};
    ctx.query.filters = withClinicFilter(ctx, ctx.query.filters || {});
    const clinicId = ctx.state?.clinicId ?? 'public';
    const cacheKey = `appointments:list:${clinicId}:${JSON.stringify(ctx.query || {})}`;
    const parentFind = super.find.bind(this);
    const data = await cache.getOrSetCache(cacheKey, TTL_APPOINTMENTS_RECENT, () => parentFind(ctx));
    return data;
  },
  async findOne(ctx) {
    const { id } = ctx.params;
    const entity = await strapi.entityService.findOne('api::appointment.appointment', id, { populate: ['clinic'] });
    if (!entity) return ctx.notFound();
    if (!ensureClinicAccess(ctx, entity)) return ctx.forbidden('No tiene acceso a esta cita');
    return super.findOne(ctx);
  },
  async create(ctx) {
    const clinicId = ctx.state?.clinicId;
    if (clinicId) ctx.request.body.data = { ...(ctx.request.body.data || {}), clinic: clinicId };
    return super.create(ctx);
  },
  async update(ctx) {
    const { id } = ctx.params;
    const entity = await strapi.entityService.findOne('api::appointment.appointment', id, { populate: ['clinic'] });
    if (!entity) return ctx.notFound();
    if (!ensureClinicAccess(ctx, entity)) return ctx.forbidden('No tiene acceso a esta cita');
    return super.update(ctx);
  },
  async delete(ctx) {
    const { id } = ctx.params;
    const entity = await strapi.entityService.findOne('api::appointment.appointment', id, { populate: ['clinic'] });
    if (!entity) return ctx.notFound();
    if (!ensureClinicAccess(ctx, entity)) return ctx.forbidden('No tiene acceso a esta cita');
    return super.delete(ctx);
  },
}));
