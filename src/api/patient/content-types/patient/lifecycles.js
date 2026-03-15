"use strict";

const eventBus = require("../../../../../modules/events/eventBus");
const { syncPatient } = require("../../../../../modules/search/sync");

module.exports = {
  async afterCreate(event) {
    await syncPatient(global.strapi, event.result, "create");
    const r = event.result;
    eventBus.emit("patient_created", {
      patientId: r?.id,
      clinicId: r?.clinic?.id ?? r?.clinic,
      metadata: { patientId: r?.id },
    });
  },
  async afterUpdate(event) {
    await syncPatient(global.strapi, event.result, "update");
  },
  async afterDelete(event) {
    const entity = event.result?.id ? event.result : { id: event.params?.where?.id };
    await syncPatient(global.strapi, entity, "delete");
  },
};
