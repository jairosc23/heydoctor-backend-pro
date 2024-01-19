"use strict";

module.exports = {
  getKeys(ctx) {
    let clientPrivateKey = global.clientPrivateKey;
    let clientPublicKey = global.clientPublicKey;
    ctx.cookies.set("x-diffie-hellman-public-key", global.clientPublicKey, {
      httpOnly: true, // Cookie is only accessible through the HTTP(S) protocol
      maxAge: 24 * 60 * 60 * 1000, // Cookie will expire in 1 day
      secure: false, // Set to true if your application is served over HTTPS
      sameSite: "None", // Set the SameSite attribute to None if cross-origin
    });

    ctx.send({
      clientPrivateKey,
      clientPublicKey
    })
  }
};
