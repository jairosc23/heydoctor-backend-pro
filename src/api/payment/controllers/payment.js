"use strict";

/**
 * payment controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController("api::payment.payment", ({ strapi }) => ({
  async create(ctx) {
    const orderNumber = await strapi
      .service("api::payment.payment")
      .checkOrderNumber();
    ctx.request.body.order = orderNumber;
    const entry = await super.create(ctx);
    return entry;
  },
}));
