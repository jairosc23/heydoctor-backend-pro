'use strict';

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::patient-reminder.patient-reminder');
