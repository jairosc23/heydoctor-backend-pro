'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const { withClinicFilter, ensureClinicAccess } = require('../../../utils/tenant-scope');

module.exports = createCoreController('api::favorite-order.favorite-order', ({ strapi }) => ({
  async find(ctx) {
    ctx.query = ctx.query || {};
    ctx.query.filters = withClinicFilter(ctx, ctx.query.filters || {});
    return super.find(ctx);
  },
  async findOne(ctx) {
    const entity = await strapi.entityService.findOne('api::favorite-order.favorite-order', ctx.params.id, { populate: ['clinic'] });
    if (!entity) return ctx.notFound();
    if (!ensureClinicAccess(ctx, entity)) return ctx.forbidden('No tiene acceso a este favorito');
    return super.findOne(ctx);
  },
  async create(ctx) {
    const clinicId = ctx.state?.clinicId;
    const user = ctx.state?.user;
    if (!clinicId) return ctx.forbidden('Se requiere contexto de clínica');
    const doctor = user ? await strapi.db.query('api::doctor.doctor').findOne({ where: { user: user.id } }) : null;
    ctx.request.body.data = {
      ...(ctx.request.body.data || {}),
      clinic: clinicId,
      doctor: doctor?.id ?? null,
    };
    return super.create(ctx);
  },
  async update(ctx) {
    const entity = await strapi.entityService.findOne('api::favorite-order.favorite-order', ctx.params.id, { populate: ['clinic'] });
    if (!entity) return ctx.notFound();
    if (!ensureClinicAccess(ctx, entity)) return ctx.forbidden('No tiene acceso a este favorito');
    return super.update(ctx);
  },
  async delete(ctx) {
    const entity = await strapi.entityService.findOne('api::favorite-order.favorite-order', ctx.params.id, { populate: ['clinic'] });
    if (!entity) return ctx.notFound();
    if (!ensureClinicAccess(ctx, entity)) return ctx.forbidden('No tiene acceso a este favorito');
    return super.delete(ctx);
  },
}));
