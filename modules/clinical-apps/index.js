"use strict";

/**
 * Clinical Apps Framework - AI Doctor OS.
 * Permite registrar y consumir apps clínicas integradas con FHIR y AI.
 */

const registry = require("./registry");
const fhir = require("../fhir");

module.exports = {
  ...registry,
  /**
   * Obtiene recursos FHIR disponibles para apps clínicas.
   * Patient, Encounter, Observation, MedicationRequest.
   */
  getFhirResources() {
    return {
      Patient: { endpoint: "/api/fhir/patient/:id", converter: fhir.patient },
      Encounter: { endpoint: "/api/fhir/encounter/:id", converter: fhir.encounter },
      Observation: { endpoint: "/api/fhir/observation/:id", converter: fhir.observation },
      MedicationRequest: { endpoint: null, converter: fhir.medicationRequest },
    };
  },
};
