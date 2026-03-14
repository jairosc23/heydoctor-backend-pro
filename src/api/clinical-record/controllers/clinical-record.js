'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const { withClinicFilter, ensureClinicAccess } = require('../../../utils/tenant-scope');
const { auditLogger } = require('../../../utils/audit-logger');

module.exports = createCoreController('api::clinical-record.clinical-record', ({ strapi }) => ({
  async find(ctx) {
    ctx.query = ctx.query || {};
    ctx.query.filters = withClinicFilter(ctx, ctx.query.filters || {});
    return super.find(ctx);
  },
  async findOne(ctx) {
    const { id } = ctx.params;
    const entity = await strapi.entityService.findOne('api::clinical-record.clinical-record', id, { populate: ['clinic', 'patient'] });
    if (!entity) return ctx.notFound();
    if (!ensureClinicAccess(ctx, entity)) return ctx.forbidden('No tiene acceso a este registro clínico');
    const patientId = entity.patient?.id ?? entity.patient;
    await auditLogger(strapi, 'VIEW_MEDICAL_RECORD', ctx, { patient_id: patientId, clinical_record_id: id });
    return super.findOne(ctx);
  },
  async create(ctx) {
    const clinicId = ctx.state?.clinicId;
    if (clinicId) ctx.request.body.data = { ...(ctx.request.body.data || {}), clinic: clinicId };
    return super.create(ctx);
  },
  async update(ctx) {
    const { id } = ctx.params;
    const entity = await strapi.entityService.findOne('api::clinical-record.clinical-record', id, { populate: ['clinic'] });
    if (!entity) return ctx.notFound();
    if (!ensureClinicAccess(ctx, entity)) return ctx.forbidden('No tiene acceso a este registro clínico');
    return super.update(ctx);
  },
  async delete(ctx) {
    const { id } = ctx.params;
    const entity = await strapi.entityService.findOne('api::clinical-record.clinical-record', id, { populate: ['clinic'] });
    if (!entity) return ctx.notFound();
    if (!ensureClinicAccess(ctx, entity)) return ctx.forbidden('No tiene acceso a este registro clínico');
    return super.delete(ctx);
  },
}));
