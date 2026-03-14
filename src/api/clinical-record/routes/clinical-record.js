'use strict';

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::clinical-record.clinical-record', {
  config: {
    find: { policies: ['global::tenant-resolver'] },
    findOne: { policies: ['global::tenant-resolver'] },
    create: { policies: ['global::tenant-resolver'] },
    update: { policies: ['global::tenant-resolver'] },
    delete: { policies: ['global::tenant-resolver'] },
  },
});
