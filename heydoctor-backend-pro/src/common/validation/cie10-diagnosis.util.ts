/**
 * Heurística CIE-10 / ICD-10: si el texto empieza por un código, debe cumplir letra + 2 dígitos + subcódigo opcional.
 * No valida existencia en catálogo oficial.
 */
const LEADING_CIE10 =
  /^([A-TV-Z][0-9]{2}(?:\.[0-9A-TV-Z]{1,4})?)(?=$|[\s\-–—:])/i;

export function diagnosisHasValidLeadingCie10IfPresent(text: string): boolean {
  const t = text.trim();
  if (!t) {
    return true;
  }
  const m = t.match(LEADING_CIE10);
  if (!m || m.index !== 0) {
    return true;
  }
  return m[1].length > 0;
}

/** `true` si el diagnóstico (tras trim) comienza por un prefijo con forma de código CIE-10. */
export function diagnosisHasLeadingCie10Prefix(text: string): boolean {
  const t = text.trim();
  const m = t.match(LEADING_CIE10);
  return m !== null && m.index === 0;
}
