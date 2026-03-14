'use strict';

const eventBus = require('../events/eventBus');

/**
 * Media event listeners - attach images to medical record, etc.
 */
function registerMediaListeners(strapi) {
  eventBus.on('IMAGE_CAPTURED', async (payload) => {
    const { consultationId, imageId, appointmentId } = payload;
    if (!appointmentId && !consultationId) return;

    const aptId = appointmentId ?? consultationId;
    try {
      const apt = await strapi.entityService.findOne('api::appointment.appointment', aptId, {
        populate: ['files'],
      });
      if (apt && imageId) {
        const files = apt.files ? (Array.isArray(apt.files) ? apt.files : [apt.files]) : [];
        const ids = files.map((f) => f.id ?? f);
        if (!ids.includes(imageId)) {
          await strapi.entityService.update('api::appointment.appointment', aptId, {
            data: { files: [...ids, imageId] },
          });
        }
      }
    } catch (err) {
      strapi.log.warn('media IMAGE_CAPTURED handler failed:', err.message);
    }
  });
}

module.exports = { registerMediaListeners };
