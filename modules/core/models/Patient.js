'use strict';

/**
 * Patient domain model - encapsulates patient ownership and medical record logic.
 * Maps to Strapi patient entity.
 */
class Patient {
  constructor(data) {
    this.id = data?.id;
    this.user = data?.user;
    this.clinical_record = data?.clinical_record;
    this.clinic = data?.clinic;
  }

  validateOwnership(userId) {
    const patientUserId = this.user?.id ?? this.user;
    return patientUserId === userId;
  }

  getMedicalRecordId() {
    return this.clinical_record?.id ?? this.clinical_record;
  }

  hasMedicalRecord() {
    return !!this.getMedicalRecordId();
  }

  belongsToClinic(clinicId) {
    const cid = this.clinic?.id ?? this.clinic;
    return cid === clinicId;
  }
}

module.exports = Patient;
