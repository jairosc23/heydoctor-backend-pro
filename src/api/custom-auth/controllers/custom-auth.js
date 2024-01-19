"use strict";

/**
 * A set of functions called "actions" for `custom-auth`
 */

const {
  generateDiffieHellmanKeys,
  encryptData,
  decryptData,
  deriveSharedSecret,
} = require("../../utils/encryption");

module.exports = {
  async login(ctx) {
    // Send publicKey to the client (e.g., as a response header)
    ctx.cookies.set("x-diffie-hellman-public-key", global.clientPublicKey, {
      httpOnly: true, // Cookie is only accessible through the HTTP(S) protocol
      maxAge: 24 * 60 * 60 * 1000, // Cookie will expire in 1 day
      secure: false, // Set to true if your application is served over HTTPS
      sameSite: "None", // Set the SameSite attribute to None if cross-origin
    });

    // Pass the decrypted data to the default login controller
    const result = await strapi.plugins[
      "users-permissions"
    ].controllers.auth.callback(ctx);

    // Customize the response or handle errors if needed
    return result;
  },

  async register(ctx) {
    ctx.cookies.set("x-diffie-hellman-public-key", global.clientPublicKey, {
      httpOnly: true, // Cookie is only accessible through the HTTP(S) protocol
      maxAge: 24 * 60 * 60 * 1000, // Cookie will expire in 1 day
      secure: false, // Set to true if your application is served over HTTPS
      sameSite: "None", // Set the SameSite attribute to None if cross-origin
    });

    // Pass the decrypted data to the default signup controller
    const result = await strapi.plugins[
      "users-permissions"
    ].controllers.auth.register(ctx);

    // Customize the response or handle errors if needed
    return result;
  },
};
