"use strict";

const eventBus = require("../../../../../modules/events/eventBus");

module.exports = {
  async afterCreate(event) {
    const r = event.result;
    eventBus.emit("clinical_record_created", {
      clinicalRecordId: r?.id,
      patientId: r?.patient?.id ?? r?.patient,
      clinicId: r?.clinic?.id ?? r?.clinic,
      metadata: { clinicalRecordId: r?.id },
    });
  },
};
