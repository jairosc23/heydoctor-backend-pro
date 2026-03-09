"use strict";

module.exports = {
  getKeys(ctx) {
    const clientPublicKey = global.clientPublicKey;

    if (!clientPublicKey) {
      return ctx.notFound("Encryption keys not initialized");
    }

    ctx.cookies.set("x-diffie-hellman-public-key", clientPublicKey, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "Strict" : "Lax",
    });

    ctx.send({ clientPublicKey });
  },
};
