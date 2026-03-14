'use strict';

const { createConsultationsController } = require('../../../../modules/consultations/consultations.controller');

module.exports = {
  async start(ctx) {
    const ctrl = createConsultationsController(strapi);
    return ctrl.start(ctx);
  },
  async doctorJoin(ctx) {
    const ctrl = createConsultationsController(strapi);
    return ctrl.doctorJoin(ctx);
  },
  async patientJoin(ctx) {
    const ctrl = createConsultationsController(strapi);
    return ctrl.patientJoin(ctx);
  },
  async transitionStatus(ctx) {
    const ctrl = createConsultationsController(strapi);
    return ctrl.transitionStatus(ctx);
  },
};
