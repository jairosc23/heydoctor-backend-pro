"use strict";

const { initialize } = require("../config/functions/websockets");

module.exports = {
  register(/*{ strapi }*/) {},

  async bootstrap({ strapi }) {
    await initialize(strapi);
  },
};
