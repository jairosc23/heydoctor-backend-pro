"use strict";

const { Server } = require("socket.io");

const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || "https://heydoctor.health,https://www.heydoctor.health").split(",").map(s => s.trim());

const findSocketConnection = async (userID) => {
  try {
    const user = await strapi.db
      .query("api::connection.connection")
      .findOne({ where: { userID: userID } });
    return [user, null];
  } catch (error) {
    strapi.log.error("findSocketConnection error:", error);
    return [null, error];
  }
};

const createSocketConnection = async (userID, socketID) => {
  try {
    await strapi.db.query("api::connection.connection").create({
      data: {
        userID: userID,
        socketID: socketID,
        isConnected: true,
      },
    });
  } catch (error) {
    strapi.log.error("createSocketConnection error:", error);
  }
};

const disconnectSocketConnection = async (socketID) => {
  try {
    const connection = await strapi.db
      .query("api::connection.connection")
      .findOne({ where: { socketID: socketID } });
    if (connection && connection.isConnected) {
      await strapi.db.query("api::connection.connection").update({
        where: { socketID: socketID },
        data: { socketID: null, isConnected: false },
      });
    }
  } catch (error) {
    strapi.log.error("disconnectSocketConnection error:", error);
  }
};

const connectSocketConnection = async (userID, socketID) => {
  try {
    await strapi.db.query("api::connection.connection").update({
      where: { userID: userID },
      data: { socketID: socketID, isConnected: true },
    });
  } catch (error) {
    strapi.log.error("connectSocketConnection error:", error);
  }
};

const socketHandler = async (socket) => {
  const socketID = socket.id;
  const authenticatedUserID = socket.data.userID;

  socket.on("disconnect", async () => {
    try {
      await disconnectSocketConnection(socketID);
    } catch (error) {
      strapi.log.error("socket disconnect error:", error);
    }
  });

  socket.on("join", async (data) => {
    const userID = data.userID;

    if (String(userID) !== String(authenticatedUserID)) {
      socket.emit("error", { message: "Unauthorized: userID mismatch" });
      return;
    }

    try {
      const [user, errorUser] = await findSocketConnection(userID);
      if (errorUser !== null) {
        strapi.log.error("join findSocketConnection error:", errorUser);
        return;
      }
      if (user) await connectSocketConnection(userID, socketID);
      else await createSocketConnection(userID, socketID);
    } catch (error) {
      strapi.log.error("join error:", error);
    }
  });
};

const initialize = async (strapi) => {
  const httpServer = strapi.server.httpServer;

  const corsConfig = {
    origin: process.env.NODE_ENV === "production" ? ALLOWED_ORIGINS : true,
    methods: ["GET", "POST"],
    credentials: true,
  };

  let io;
  if (process.env.NODE_ENV === "production" && process.env.REDIS_URL) {
    const Redis = require("ioredis");
    const { createAdapter } = require("@socket.io/redis-adapter");
    const pubClient = new Redis(process.env.REDIS_URL);
    const subClient = pubClient.duplicate();
    io = new Server(httpServer, { cors: corsConfig });
    io.adapter(createAdapter(pubClient, subClient));
  } else {
    io = new Server(httpServer, { cors: corsConfig });
  }

  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.query?.token ||
        (socket.handshake.headers.authorization || "").replace("Bearer ", "");

      if (!token) {
        return next(new Error("Authentication required"));
      }

      const { verify } = require("jsonwebtoken");
      const jwtSecret = strapi.config.get("plugin.users-permissions.jwtSecret") ||
        process.env.JWT_SECRET;

      const decoded = verify(token, jwtSecret);
      socket.data.userID = decoded.id;
      next();
    } catch (error) {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", socketHandler);
  strapi.io = io;

  strapi.log.info("WebSocket server initialized");
};

module.exports = {
  initialize,
  findSocketConnection,
};
