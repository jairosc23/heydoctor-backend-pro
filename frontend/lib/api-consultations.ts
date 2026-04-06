/**
 * Consultas clínicas (Nest HeyDoctor).
 */

const getAuthHeaders = () => {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('jwt') || localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const getApiBase = () =>
  (typeof window !== 'undefined' && (window as unknown as { __API_URL__?: string }).__API_URL__) ||
  process.env.NEXT_PUBLIC_API_URL ||
  '';

const jsonHeaders = () => ({
  ...getAuthHeaders(),
  'Content-Type': 'application/json',
});

export type ConsultationStatus =
  | 'draft'
  | 'in_progress'
  | 'completed'
  | 'signed'
  | 'locked';

export type Consultation = {
  id: string;
  patientId: string;
  clinicId: string;
  doctorId: string;
  chiefComplaint: string;
  symptoms: string | null;
  diagnosis: string | null;
  treatmentPlan: string | null;
  notes: string | null;
  status: ConsultationStatus;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
};

export type PatchConsultationPayload = Partial<{
  chiefComplaint: string;
  symptoms: string;
  diagnosis: string;
  treatmentPlan: string;
  notes: string;
  status: ConsultationStatus;
}>;

export async function fetchConsultation(consultationId: string): Promise<Consultation> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/consultations/${consultationId}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('No se pudo cargar la consulta');
  return res.json() as Promise<Consultation>;
}

export async function patchConsultation(
  consultationId: string,
  body: PatchConsultationPayload,
): Promise<Consultation> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/consultations/${consultationId}`, {
    method: 'PATCH',
    headers: jsonHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `Error ${res.status}`;
    try {
      const err = await res.json();
      if (typeof err?.message === 'string') msg = err.message;
      else if (Array.isArray(err?.message)) msg = err.message.join(', ');
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<Consultation>;
}
