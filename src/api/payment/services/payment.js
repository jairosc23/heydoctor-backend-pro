'use strict';

/**
 * payment service
 */

const { createCoreService } = require('@strapi/strapi').factories;

const numberRandom = (max, min) => {
  return Math.floor(Math.random() * (max - min)) + min;
};

const generateOrderNumber = () => {
  return numberRandom(9999999999999, 1000000000000);
};

module.exports = createCoreService("api::payment.payment", ({ strapi }) => ({
  async checkOrderNumber() {
    let orderNumber = generateOrderNumber();
    const order = await strapi.db.query("api::payment.payment").findOne({
      where: { order: orderNumber },
      populate: true,
    });
    if (Object.keys(order) === 0) {
      return orderNumber;
    } else {
      await this.checkOrderNumber();
    }
  },
}));
