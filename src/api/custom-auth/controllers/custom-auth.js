"use strict";

module.exports = {
  async login(ctx) {
    if (global.clientPublicKey) {
      ctx.cookies.set("x-diffie-hellman-public-key", global.clientPublicKey, {
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "Strict" : "Lax",
      });
    }

    const result = await strapi.plugins[
      "users-permissions"
    ].controllers.auth.callback(ctx);

    return result;
  },

  async register(ctx) {
    if (global.clientPublicKey) {
      ctx.cookies.set("x-diffie-hellman-public-key", global.clientPublicKey, {
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "Strict" : "Lax",
      });
    }

    const result = await strapi.plugins[
      "users-permissions"
    ].controllers.auth.register(ctx);

    return result;
  },
};
