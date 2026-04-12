/**
 * API client para Templates, Favorite Orders y Patient Reminders.
 */

import { apiCredentialsInit } from './api-credentials';
import { requireBearerHeaders, requireHeydoctorApiBase } from './heydoctor-api';

const getHeaders = () => requireBearerHeaders();

const jsonHeaders = () =>
  requireBearerHeaders({ 'Content-Type': 'application/json' });

const toData = (body: any) => (body?.data ? body : { data: body });

/** Templates */
export interface TemplateData {
  name: string;
  default_symptoms?: string[];
  recommended_diagnostics?: Array<{ code: string; description?: string }>;
  suggested_treatments?: string[];
  clinical_note_template?: string;
}

export async function fetchTemplates() {
  const base = requireHeydoctorApiBase();
  const res = await fetch(`${base}/api/templates`, {
    ...apiCredentialsInit,
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch templates');
  const json = await res.json();
  return json.data ?? json;
}

export async function createTemplate(data: TemplateData) {
  const base = requireHeydoctorApiBase();
  const res = await fetch(`${base}/api/templates`, {
    ...apiCredentialsInit,
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(toData(data)),
  });
  if (!res.ok) throw new Error('Failed to create template');
  return res.json();
}

export async function updateTemplate(id: number | string, data: Partial<TemplateData>) {
  const base = requireHeydoctorApiBase();
  const res = await fetch(`${base}/api/templates/${id}`, {
    ...apiCredentialsInit,
    method: 'PUT',
    headers: jsonHeaders(),
    body: JSON.stringify(toData(data)),
  });
  if (!res.ok) throw new Error('Failed to update template');
  return res.json();
}

export async function deleteTemplate(id: number | string) {
  const base = requireHeydoctorApiBase();
  const res = await fetch(`${base}/api/templates/${id}`, {
    ...apiCredentialsInit,
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete template');
}

/** Favorite Orders */
export interface FavoriteOrderItem {
  type: 'diagnostic' | 'treatment' | 'prescription';
  value: string;
}

export interface FavoriteOrderData {
  name: string;
  items: FavoriteOrderItem[];
  diagnosis_code?: string;
}

export async function fetchFavoriteOrders() {
  const base = requireHeydoctorApiBase();
  const res = await fetch(`${base}/api/favorite-orders`, {
    ...apiCredentialsInit,
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch favorite orders');
  const json = await res.json();
  return json.data ?? json;
}

export async function createFavoriteOrder(data: FavoriteOrderData) {
  const base = requireHeydoctorApiBase();
  const res = await fetch(`${base}/api/favorite-orders`, {
    ...apiCredentialsInit,
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(toData(data)),
  });
  if (!res.ok) throw new Error('Failed to create favorite order');
  return res.json();
}

export async function deleteFavoriteOrder(id: number | string) {
  const base = requireHeydoctorApiBase();
  const res = await fetch(`${base}/api/favorite-orders/${id}`, {
    ...apiCredentialsInit,
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete favorite order');
}

/** Patient Reminders */
export interface PatientReminderData {
  patient: number;
  reminder_type?: string;
  message: string;
  due_date: string;
  appointment?: number;
}

export async function fetchPatientReminders(patientId?: number | string) {
  const base = requireHeydoctorApiBase();
  const params = patientId ? `?filters[patient][id][$eq]=${patientId}` : '';
  const res = await fetch(`${base}/api/patient-reminders${params}`, {
    ...apiCredentialsInit,
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch patient reminders');
  const json = await res.json();
  return json.data ?? json;
}

export async function createPatientReminder(data: PatientReminderData) {
  const base = requireHeydoctorApiBase();
  const res = await fetch(`${base}/api/patient-reminders`, {
    ...apiCredentialsInit,
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(toData(data)),
  });
  if (!res.ok) throw new Error('Failed to create patient reminder');
  return res.json();
}

export async function updatePatientReminder(id: number | string, data: Partial<PatientReminderData> & { status?: string }) {
  const base = requireHeydoctorApiBase();
  const res = await fetch(`${base}/api/patient-reminders/${id}`, {
    ...apiCredentialsInit,
    method: 'PUT',
    headers: jsonHeaders(),
    body: JSON.stringify(toData(data)),
  });
  if (!res.ok) throw new Error('Failed to update patient reminder');
  return res.json();
}
