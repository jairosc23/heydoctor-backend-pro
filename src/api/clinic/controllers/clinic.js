'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::clinic.clinic', ({ strapi }) => ({
  async me(ctx) {
    const clinicId = ctx.state?.clinicId;
    const clinic = ctx.state?.clinic;
    if (!clinicId || !clinic) {
      return ctx.send({ data: null });
    }
    return ctx.send({ data: clinic });
  },
  async create(ctx) {
    const user = ctx.state?.user;
    if (!user) return ctx.unauthorized('Debe iniciar sesión para crear una clínica');

    const { data } = ctx.request.body || {};
    if (!data) return ctx.badRequest('Datos de clínica requeridos');

    const clinic = await strapi.entityService.create('api::clinic.clinic', { data });
    await strapi.entityService.create('api::clinic-user.clinic-user', {
      data: {
        clinic: clinic.id,
        user: user.id,
        role: 'owner',
      },
    });

    const sanitized = await this.sanitizeOutput(clinic, ctx);
    return this.transformResponse(sanitized);
  },
}));
