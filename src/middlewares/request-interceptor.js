"use strict";

const {
  generateDiffieHellmanKeys,
  deriveSharedSecret,
  createSessionKey,
  encryptData,
  decryptData,
} = require("../api/utils/encryption");

/**
 * `request-interceptor` middleware
 */

module.exports = async (config, { strapi }) => {
  // Check if the request path starts with '/api'
  return async (ctx, next) => {
    const isApiRequest = ctx.request.path.startsWith("/api");

    if (isApiRequest) {
      // This is an API request, perform actions before each API request
      console.log(
        `API Request Method: ${ctx.request.method}, Path: ${ctx.request.path}`
      );

      // Continue with the next middleware in the stack
      await next();

      // Perform actions after each API request
      // (This code will be executed after the response has been sent)
    } else {
      // This is not an API request, skip the interceptor
      await next();
    }
  };
};
