"use strict";

const clinicalApps = require("../../../../modules/clinical-apps");

module.exports = {
  /**
   * Lista apps clínicas disponibles para la clínica del usuario.
   * Filtra por enabled_clinical_apps si la clínica lo tiene configurado.
   */
  async list(ctx) {
    const user = ctx.state?.user;
    if (!user) return ctx.unauthorized("Autenticación requerida");

    const strapi = global.strapi;
    if (!strapi) return ctx.internalServerError("Servicio no disponible");

    let clinic = null;
    const clinicId = ctx.state?.clinicId ?? ctx.query?.clinicId;
    if (clinicId) {
      clinic = await strapi.entityService.findOne("api::clinic.clinic", clinicId, {
        fields: ["id", "enabled_clinical_apps"],
      });
    }

    const apps = clinicalApps.getAppsForClinic(clinic);
    return ctx.send({ apps });
  },

  /**
   * Obtiene una app por nombre.
   */
  async get(ctx) {
    const user = ctx.state?.user;
    if (!user) return ctx.unauthorized("Autenticación requerida");

    const { name } = ctx.params;
    const app = clinicalApps.getClinicalApp(name);
    if (!app) return ctx.notFound("App no encontrada");
    return ctx.send({ app });
  },

  /**
   * Recursos FHIR disponibles para apps clínicas.
   */
  async fhirResources(ctx) {
    const user = ctx.state?.user;
    if (!user) return ctx.unauthorized("Autenticación requerida");

    const resources = clinicalApps.getFhirResources();
    return ctx.send({ resources: Object.keys(resources), endpoints: resources });
  },
};
