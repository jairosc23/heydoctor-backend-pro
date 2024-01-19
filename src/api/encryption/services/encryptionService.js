"use strict";

const { createCoreService } = require("@strapi/strapi").factories;
const { generateDiffieHellmanKeys } = require("../../utils/encryption");

/**
 * encryption service
 */


module.exports = createCoreService(
  "api::encryption.encryption",
  ({ strapi }) => ({
    initialize: async () => {
      const { publicKey, privateKey } = generateDiffieHellmanKeys();

      global.serverPrivateKey = privateKey;
      global.serverPublicKey = publicKey;
    },
    getPrivateKey: () => global.serverPrivateKey,
    getPublicKey: () => global.serverPublicKey,
  })
);
