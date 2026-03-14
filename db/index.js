"use strict";

require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DATABASE_HOST || "localhost",
  port: parseInt(process.env.DATABASE_PORT || "5432", 10),
  user: process.env.DATABASE_USERNAME || "postgres",
  password: process.env.DATABASE_PASSWORD || "postgres",
  database: process.env.DATABASE_NAME || "heydoctor",
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on("error", (err) => {
  if (global.strapi?.log) {
    global.strapi.log.error("db pool error:", err.message);
  } else {
    console.error("db pool error:", err.message);
  }
});

module.exports = pool;
