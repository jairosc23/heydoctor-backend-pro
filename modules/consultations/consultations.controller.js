'use strict';

const { createConsultationsService } = require('./consultations.service');

/**
 * Consultations controller - validates, authenticates, calls service.
 * Handles consultation lifecycle: start, join, status transition.
 */
function createConsultationsController(strapi) {
  const service = createConsultationsService(strapi);

  return {
    async start(ctx) {
      const { id } = ctx.params;
      const user = ctx.state?.user;
      if (!user) return ctx.unauthorized();

      const doctor = await strapi.db.query('api::doctor.doctor').findOne({ where: { user: user.id } });
      const patient = await strapi.db.query('api::patient.patient').findOne({ where: { user: user.id } });
      const doctorId = doctor?.id;
      const patientId = patient?.id;

      try {
        const apt = await service.startConsultation(id, doctorId, patientId);
        return ctx.send({ data: apt });
      } catch (err) {
        return ctx.badRequest(err.message);
      }
    },

    async doctorJoin(ctx) {
      const { id } = ctx.params;
      const user = ctx.state?.user;
      if (!user) return ctx.unauthorized();

      const doctor = await strapi.db.query('api::doctor.doctor').findOne({ where: { user: user.id } });
      if (!doctor) return ctx.forbidden('Usuario no es doctor');

      try {
        const apt = await service.doctorJoin(id, doctor.id);
        return ctx.send({ data: apt });
      } catch (err) {
        return ctx.badRequest(err.message);
      }
    },

    async patientJoin(ctx) {
      const { id } = ctx.params;
      const user = ctx.state?.user;
      if (!user) return ctx.unauthorized();

      const patient = await strapi.db.query('api::patient.patient').findOne({ where: { user: user.id } });
      if (!patient) return ctx.forbidden('Usuario no es paciente');

      try {
        const apt = await service.patientJoin(id, patient.id);
        return ctx.send({ data: apt });
      } catch (err) {
        return ctx.badRequest(err.message);
      }
    },

    async transitionStatus(ctx) {
      const { id } = ctx.params;
      const { status } = ctx.request.body || {};
      const user = ctx.state?.user;
      if (!user) return ctx.unauthorized();
      if (!status) return ctx.badRequest('status requerido');

      const doctor = await strapi.db.query('api::doctor.doctor').findOne({ where: { user: user.id } });
      const patient = await strapi.db.query('api::patient.patient').findOne({ where: { user: user.id } });

      try {
        const apt = await service.transitionStatus(id, status, doctor?.id, patient?.id);
        return ctx.send({ data: apt });
      } catch (err) {
        return ctx.badRequest(err.message);
      }
    },
  };
}

module.exports = { createConsultationsController };
