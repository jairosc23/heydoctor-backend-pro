/**
 * Elimina claves que suelen contener PHI antes de enviar contexto a modelos externos.
 * No sustituye controles de acceso en API; solo reduce fuga en prompts.
 */
const PHI_LIKE_KEYS = new Set(
  [
    'firstname',
    'lastname',
    'firstName',
    'lastName',
    'name',
    'fullName',
    'email',
    'phone',
    'identification',
    'identification_type',
    'birth_date',
    'birthDate',
    'dob',
    'dateOfBirth',
    'ssn',
    'document',
    'passport',
    'rut',
    'uid',
    'userId',
    'address',
    'street',
    'city',
    'province',
    'profile_picture',
    'medicalRecordNumber',
    'mrn',
  ].map((k) => k.toLowerCase()),
);

function isPhiLikeKey(key: string): boolean {
  const k = key.toLowerCase();
  if (PHI_LIKE_KEYS.has(k)) return true;
  if (k.includes('email')) return true;
  if (k.includes('phone') || k.includes('telephone')) return true;
  if (k.includes('identif')) return true;
  return false;
}

export function sanitizeObjectForAi(
  value: unknown,
  depth = 0,
): unknown {
  if (depth > 8) return '[truncated]';
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((v) => sanitizeObjectForAi(v, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isPhiLikeKey(k)) {
        out[k] = '[redacted]';
        continue;
      }
      out[k] = sanitizeObjectForAi(v, depth + 1);
    }
    return out;
  }
  return value;
}

export function sanitizeContextJsonForAi(
  context: Record<string, unknown> | undefined,
): string {
  if (!context || typeof context !== 'object') return '{}';
  try {
    return JSON.stringify(sanitizeObjectForAi(context));
  } catch {
    return '{}';
  }
}

/**
 * Texto libre antes de enviarlo a un LLM: trunca y reduce fugas obvias (email, cadenas largas de dígitos).
 */
export function sanitizeFreeTextForAi(
  input: string | undefined | null,
  maxLen = 8000,
): string {
  let s = (input ?? '').slice(0, maxLen);
  s = s.replace(/\b[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, '[redacted]');
  s = s.replace(/\b\+?\d[\d\s\-]{8,}\b/g, '[redacted]');
  s = s.replace(/\b\d{6,}\b/g, '[redacted]');
  return s;
}
