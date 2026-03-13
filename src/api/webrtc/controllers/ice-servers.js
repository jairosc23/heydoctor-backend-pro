"use strict";

module.exports = {
  async getIceServers(ctx) {
    const iceServers = [
      {
        urls: ["stun:stun.l.google.com:19302"],
      },
    ];

    const turnUsername = process.env.TURN_USERNAME;
    const turnPassword = process.env.TURN_PASSWORD;

    if (turnUsername && turnPassword) {
      iceServers.push({
        urls: [
          "turn:global.turn.twilio.com:3478?transport=udp",
          "turn:global.turn.twilio.com:3478?transport=tcp",
          "turns:global.turn.twilio.com:5349?transport=tcp",
        ],
        username: turnUsername,
        credential: turnPassword,
      });
    }

    ctx.send({ iceServers });
  },
};
