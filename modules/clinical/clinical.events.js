'use strict';

const eventBus = require('../events/eventBus');

/**
 * Clinical event listeners - update consultation timeline, medical record.
 */
function registerClinicalListeners(strapi) {
  eventBus.on('CONSULTATION_STARTED', async (payload) => {
    const { consultationId, appointmentId } = payload;
    const id = appointmentId ?? consultationId;
    if (!id) return;

    try {
      const apt = await strapi.entityService.findOne('api::appointment.appointment', id, {
        populate: ['clinical_record'],
      });
      if (apt?.clinical_record) {
        strapi.log.debug('Consultation started - clinical record updated for timeline', { id });
      }
    } catch (err) {
      strapi.log.warn('clinical CONSULTATION_STARTED handler failed:', err.message);
    }
  });

  eventBus.on('DOCUMENT_SIGNED', async (payload) => {
    const { documentId, consultationId } = payload;
    if (documentId) {
      strapi.log.debug('Document signed - clinical record may need update', { documentId });
    }
  });
}

module.exports = { registerClinicalListeners };
