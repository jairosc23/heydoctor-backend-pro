"use strict";

const pool = require("../db");

/**
 * Auditoría controller - consultas directas a PostgreSQL para logs de auditoría.
 * Compatible con rutas que importen este controlador.
 */
module.exports = {
  /**
   * Obtener registros de auditoría (raw SQL cuando se necesita fuera de Strapi).
   */
  async query(sql, params = []) {
    const client = await pool.connect();
    try {
      const result = await client.query(sql, params);
      return result.rows;
    } finally {
      client.release();
    }
  },

  /**
   * Pool para uso directo si se necesita.
   */
  get pool() {
    return pool;
  },
};
