'use strict';

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::audit-log.audit-log');
