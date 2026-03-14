'use strict';

const Consultation = require('../core/models/Consultation');

function validateConsultationId(id) {
  const n = parseInt(id, 10);
  if (isNaN(n) || n < 1) throw new Error('ID de consulta inválido');
  return n;
}

function validateStatus(status) {
  if (!Consultation.isValidStatus(status)) {
    throw new Error(`Estado inválido: ${status}. Válidos: scheduled, in_progress, completed, cancelled, no_show`);
  }
  return status;
}

function validateTransition(currentStatus, newStatus) {
  const c = new Consultation({ status: currentStatus });
  if (!c.canTransitionTo(newStatus)) {
    throw new Error(`Transición no permitida: ${currentStatus} -> ${newStatus}`);
  }
  return newStatus;
}

module.exports = {
  validateConsultationId,
  validateStatus,
  validateTransition,
};
