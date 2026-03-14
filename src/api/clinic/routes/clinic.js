'use strict';

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::clinic.clinic', {
  config: {
    create: { policies: ['global::tenant-resolver'] },
  },
});
