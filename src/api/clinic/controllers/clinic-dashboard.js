'use strict';

/**
 * Clinic dashboard endpoints - returns only clinic-scoped data.
 * Requires tenant-resolver policy with requireClinic.
 */
module.exports = {
  async patients(ctx) {
    const clinicId = ctx.state?.clinicId;
    if (!clinicId) return ctx.forbidden('Usuario no asociado a ninguna clínica');

    const patients = await strapi.entityService.findMany('api::patient.patient', {
      filters: { clinic: clinicId },
      ...ctx.query,
    });
    return ctx.send({ data: patients });
  },

  async consultations(ctx) {
    const clinicId = ctx.state?.clinicId;
    if (!clinicId) return ctx.forbidden('Usuario no asociado a ninguna clínica');

    const appointments = await strapi.entityService.findMany('api::appointment.appointment', {
      filters: { clinic: clinicId },
      populate: ['patient', 'doctor', 'specialty_profile'],
      ...ctx.query,
    });
    return ctx.send({ data: appointments });
  },

  async documents(ctx) {
    const clinicId = ctx.state?.clinicId;
    if (!clinicId) return ctx.forbidden('Usuario no asociado a ninguna clínica');

    const clinicalRecords = await strapi.entityService.findMany('api::clinical-record.clinical-record', {
      filters: { clinic: clinicId },
      populate: ['patient'],
      ...ctx.query,
    });
    return ctx.send({ data: clinicalRecords });
  },
};
