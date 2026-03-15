'use strict';

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::patient-reminder.patient-reminder', {
  config: {
    find: { policies: [{ name: 'global::tenant-resolver', config: { requireClinic: true } }] },
    findOne: { policies: [{ name: 'global::tenant-resolver', config: { requireClinic: true } }] },
    create: { policies: [{ name: 'global::tenant-resolver', config: { requireClinic: true } }] },
    update: { policies: [{ name: 'global::tenant-resolver', config: { requireClinic: true } }] },
    delete: { policies: [{ name: 'global::tenant-resolver', config: { requireClinic: true } }] },
  },
});
