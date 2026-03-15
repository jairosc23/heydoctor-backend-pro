'use strict';

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::favorite-order.favorite-order');
