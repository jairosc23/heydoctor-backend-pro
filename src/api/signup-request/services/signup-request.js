'use strict';

/**
 * signup-request service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::signup-request.signup-request');
