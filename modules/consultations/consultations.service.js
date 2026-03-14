'use strict';

const Consultation = require('../core/models/Consultation');
const eventBus = require('../events/eventBus');
const { validateConsultationId, validateTransition } = require('./consultations.validators');

/**
 * Consultations service - business logic for consultation lifecycle.
 * Appointment in Strapi = Consultation in domain.
 */
function createConsultationsService(strapi) {
  return {
    async find(filters = {}) {
      return strapi.entityService.findMany('api::appointment.appointment', {
        filters,
        populate: ['doctor', 'patient', 'videocall', 'specialty_profile', 'clinic'],
      });
    },

    async findById(id) {
      validateConsultationId(id);
      const apt = await strapi.entityService.findOne('api::appointment.appointment', id, {
        populate: ['doctor', 'patient', 'videocall', 'clinical_record', 'clinic'],
      });
      return apt;
    },

    async create(data) {
      return strapi.entityService.create('api::appointment.appointment', { data });
    },

    async update(id, data) {
      validateConsultationId(id);
      return strapi.entityService.update('api::appointment.appointment', id, { data });
    },

    async delete(id) {
      validateConsultationId(id);
      return strapi.entityService.delete('api::appointment.appointment', id);
    },

    async startConsultation(id, doctorId, patientId) {
      const apt = await this.findById(id);
      if (!apt) return null;

      const consultation = new Consultation(apt);
      if (!consultation.canStartConsultation(doctorId, patientId)) {
        throw new Error('No tiene permiso para iniciar esta consulta');
      }
      if (!consultation.canTransitionTo('in_progress')) {
        throw new Error(`No se puede iniciar: estado actual ${consultation.status}`);
      }

      const updated = await strapi.entityService.update('api::appointment.appointment', id, {
        data: { status: 'in_progress' },
      });

      eventBus.emit('CONSULTATION_STARTED', { consultationId: id, appointmentId: id });
      return updated;
    },

    async transitionStatus(id, newStatus, doctorId, patientId) {
      const apt = await this.findById(id);
      if (!apt) return null;

      const consultation = new Consultation(apt);
      validateTransition(consultation.status, newStatus);

      if (!consultation.verifyParticipantPermission(doctorId, patientId)) {
        throw new Error('No tiene permiso para cambiar el estado');
      }

      return strapi.entityService.update('api::appointment.appointment', id, {
        data: { status: newStatus },
      });
    },

    async doctorJoin(id, doctorId) {
      const apt = await this.findById(id);
      if (!apt) return null;

      const consultation = new Consultation(apt);
      if (!consultation.verifyDoctorPermission(doctorId)) {
        throw new Error('No es el doctor de esta consulta');
      }
      if (!consultation.isActive()) {
        throw new Error('La consulta no está activa');
      }

      return apt;
    },

    async patientJoin(id, patientId) {
      const apt = await this.findById(id);
      if (!apt) return null;

      const consultation = new Consultation(apt);
      if (!consultation.verifyPatientPermission(patientId)) {
        throw new Error('No es el paciente de esta consulta');
      }
      if (!consultation.isActive()) {
        throw new Error('La consulta no está activa');
      }

      return apt;
    },
  };
}

module.exports = { createConsultationsService };
