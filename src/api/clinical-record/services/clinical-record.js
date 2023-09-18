'use strict';

/**
 * clinical-record service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::clinical-record.clinical-record');
