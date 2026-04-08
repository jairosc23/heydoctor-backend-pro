/** Shorten UUIDs and emails for logs (not a cryptographic anonymization). */
export function maskUuid(id: string): string {
  const t = id.trim();
  if (t.length <= 10) return '***';
  return `${t.slice(0, 8)}…`;
}

/** Safe for optional FK / correlation columns in log metadata. */
export function maskOptionalUuid(id: string | null | undefined): string {
  if (id == null) return '***';
  const t = String(id).trim();
  if (t.length === 0) return '***';
  return maskUuid(t);
}

export function maskEmail(email: string): string {
  const e = email.trim();
  const at = e.indexOf('@');
  if (at <= 1) return '***@***';
  return `${e[0]}***@${e.slice(at + 1)}`;
}
