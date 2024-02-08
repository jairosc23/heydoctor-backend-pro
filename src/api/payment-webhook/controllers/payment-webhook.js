"use strict";

/**
 * payment-webhook controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

const handlePaymentNotification = (entry) => {
  const { userId, paymentStatus, paymentData } = entry;

  // Process payment notification
  console.log(
    `Received payment notification for user ${userId}: ${paymentStatus}`
  );

  // Send WebSocket notification to the client
  const io = strapi.io;
  const userSockets = io.sockets.socketsByUserId[userId];

  if (userSockets && userSockets.length > 0) {
    userSockets.forEach((socket) => {
      socket.emit("paymentNotification", { paymentStatus, paymentData });
    });
  }

  ctx.send({ message: "Payment notification processed" });
};

module.exports = createCoreController(
  "api::payment-webhook.payment-webhook",
  ({ strapi }) => ({
    async create(ctx) {
      if (ctx.request.body) {
        ctx.request.body = {
          data: {
            notification: ctx.request.body,
          },
        };
        const entry = await super.create(ctx);
        handlePaymentNotification(entry);
        return entry;
      }
    },
  })
);
