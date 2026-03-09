"use strict";

const { createCoreController } = require("@strapi/strapi").factories;
const axios = require("axios");

const TRANSACTION_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

function getPaykuClient() {
  const baseURL = process.env.PAYKU_URL;
  const token = process.env.PAYKU_TKPUB;
  if (!baseURL || !token) {
    throw new Error("PAYKU_URL and PAYKU_TKPUB environment variables are required");
  }
  return axios.create({
    baseURL,
    withCredentials: true,
    timeout: 5000,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
}

const handlePaymentNotification = async (notification) => {
  const io = strapi.io;
  if (!io || !notification) return;

  try {
    const userID = +notification.payment.additional_parameters.userID;
    const userConnection = await strapi.db
      .query("api::connection.connection")
      .findOne({ where: { userID: userID } });

    if (userConnection?.socketID) {
      io.to(userConnection.socketID).emit("paymentNotification", {
        notification,
      });
    }
  } catch (error) {
    strapi.log.error("handlePaymentNotification error:", error);
  }
};

module.exports = createCoreController(
  "api::payment-webhook.payment-webhook",
  ({ strapi }) => ({
    async create(ctx) {
      const body = ctx.request.body;

      if (!body?.data?.transaction_id) {
        return ctx.badRequest("Missing transaction_id");
      }

      const transactionId = String(body.data.transaction_id);
      if (!TRANSACTION_ID_PATTERN.test(transactionId)) {
        return ctx.badRequest("Invalid transaction_id format");
      }

      try {
        const payku = getPaykuClient();
        const tx = await payku.get(`/transaction/${transactionId}`);

        if (!tx.data?.order) {
          return ctx.badRequest("Invalid transaction data from Payku");
        }

        const payment = await strapi.db.query("api::payment.payment").update({
          where: { order: +tx.data.order },
          data: {
            status: tx.data.status,
          },
        });

        if (!payment) {
          return ctx.notFound("Payment not found for this order");
        }

        ctx.request.body = {
          data: {
            notification: tx.data,
            payment: payment.id,
          },
        };

        const entry = await super.create(ctx);
        await handlePaymentNotification(tx.data);
        return entry;
      } catch (error) {
        strapi.log.error("payment-webhook create error:", error);
        return ctx.internalServerError("Error processing payment webhook");
      }
    },
  })
);
