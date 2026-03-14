'use strict';

const VALID_STATUSES = ['scheduled', 'in_progress', 'completed', 'cancelled', 'no_show'];
const TRANSITIONS = {
  scheduled: ['in_progress', 'cancelled', 'no_show'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  no_show: [],
};

/**
 * Consultation domain model - encapsulates consultation lifecycle logic.
 * Maps to Strapi appointment entity.
 */
class Consultation {
  constructor(data) {
    this.id = data?.id;
    this.status = data?.status || 'scheduled';
    this.doctor = data?.doctor;
    this.patient = data?.patient;
    this.videocall = data?.videocall;
    this.date = data?.date;
  }

  canStartConsultation(doctorId, patientId) {
    if (this.status !== 'scheduled') return false;
    const aptDoctorId = this.doctor?.id ?? this.doctor;
    const aptPatientId = this.patient?.id ?? this.patient;
    return aptDoctorId === doctorId || aptPatientId === patientId;
  }

  canTransitionTo(newStatus) {
    return TRANSITIONS[this.status]?.includes(newStatus) ?? false;
  }

  verifyDoctorPermission(doctorId) {
    const aptDoctorId = this.doctor?.id ?? this.doctor;
    return aptDoctorId === doctorId;
  }

  verifyPatientPermission(patientId) {
    const aptPatientId = this.patient?.id ?? this.patient;
    return aptPatientId === patientId;
  }

  verifyParticipantPermission(doctorId, patientId) {
    return this.verifyDoctorPermission(doctorId) || this.verifyPatientPermission(patientId);
  }

  isActive() {
    return ['scheduled', 'in_progress'].includes(this.status);
  }

  static isValidStatus(status) {
    return VALID_STATUSES.includes(status);
  }
}

module.exports = Consultation;
