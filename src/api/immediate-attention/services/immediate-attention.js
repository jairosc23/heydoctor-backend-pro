'use strict';

/**
 * immediate-attention service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::immediate-attention.immediate-attention');
