'use strict';

/**
 * HeyDoctor EMR modules - central export
 */
module.exports = {
  eventBus: require('./events/eventBus'),
  models: require('./core/models'),
  consultationsService: (strapi) => require('./consultations/consultations.service').createConsultationsService(strapi),
  consultationsController: (strapi) => require('./consultations/consultations.controller').createConsultationsController(strapi),
};
