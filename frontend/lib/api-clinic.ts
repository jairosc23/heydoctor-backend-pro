/**
 * API helpers for clinic-scoped requests (Nest JWT: clínica viene del token).
 */

import { apiCredentialsInit } from './api-credentials';
import { requireBearerHeaders, requireHeydoctorApiBase } from './heydoctor-api';

export type PatientsListQuery = {
  page?: number;
  limit?: number;
  search?: string;
};

/** Listado de pacientes de la clínica del JWT. `clinicId` se ignora (compat. Strapi). */
export async function fetchPatients(
  _clinicId?: number | null,
  query?: PatientsListQuery,
) {
  const base = requireHeydoctorApiBase();
  const params = new URLSearchParams();
  if (query?.page != null) params.set('page', String(query.page));
  if (query?.limit != null) params.set('limit', String(query.limit));
  if (query?.search) params.set('search', query.search);
  const qs = params.toString();
  const res = await fetch(`${base}/api/patients${qs ? `?${qs}` : ''}`, {
    ...apiCredentialsInit,
    headers: requireBearerHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch patients');
  return res.json();
}

/** Reservado: el Nest actual no expone GET /appointments para el dashboard. */
export async function fetchAppointments(
  _clinicId?: number | null,
  query?: { page?: number; limit?: number },
) {
  const base = requireHeydoctorApiBase();
  const params = new URLSearchParams();
  if (query?.page != null) params.set('page', String(query.page));
  if (query?.limit != null) params.set('limit', String(query.limit));
  const qs = params.toString();
  const res = await fetch(`${base}/api/appointments${qs ? `?${qs}` : ''}`, {
    ...apiCredentialsInit,
    headers: requireBearerHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch appointments');
  return res.json();
}

export async function fetchClinicMe() {
  const base = requireHeydoctorApiBase();
  const res = await fetch(`${base}/api/clinics/me`, {
    ...apiCredentialsInit,
    headers: requireBearerHeaders(),
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.data ?? json;
}

/** Registro médico del paciente (consultas, diagnósticos, tratamientos) */
export async function fetchPatientMedicalRecord(patientId: number | string) {
  const base = requireHeydoctorApiBase();
  const res = await fetch(`${base}/api/patients/${patientId}/medical-record`, {
    ...apiCredentialsInit,
    headers: requireBearerHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch medical record');
  const json = await res.json();
  return json.data ?? json;
}
