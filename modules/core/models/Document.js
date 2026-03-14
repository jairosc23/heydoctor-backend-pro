'use strict';

/**
 * Document domain model - encapsulates version control, signature metadata, access validation.
 * Maps to Strapi upload file or clinical document entities.
 */
class Document {
  constructor(data) {
    this.id = data?.id;
    this.name = data?.name;
    this.related = data?.related || [];
    this.provider = data?.provider;
    this.url = data?.url;
  }

  hasSignatureMetadata() {
    return !!(this.metadata?.signedAt || this.metadata?.signedBy);
  }

  canAccess(doctorId, patientId, appointmentParticipants) {
    for (const rel of this.related) {
      const refId = rel.documentId ?? rel.id;
      const refType = rel.documentType ?? rel.__component;
      if (refType?.includes('appointment') && appointmentParticipants) {
        const apt = Array.isArray(appointmentParticipants) ? appointmentParticipants[0] : appointmentParticipants;
        const aptDoctorId = apt?.doctor?.id ?? apt?.doctor;
        const aptPatientId = apt?.patient?.id ?? apt?.patient;
        if (aptDoctorId === doctorId || aptPatientId === patientId) return true;
      }
    }
    return false;
  }

  static createVersionPayload(current, changes) {
    return {
      ...current,
      ...changes,
      version: (current.version || 1) + 1,
    };
  }
}

module.exports = Document;
