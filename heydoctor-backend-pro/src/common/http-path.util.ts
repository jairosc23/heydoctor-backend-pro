/** Longitud máxima de path en logs y contexto (evita payloads enormes). */
export const SANITIZED_PATH_MAX_LEN = 512;

/**
 * Quita query y fragmento, trunca a {@link SANITIZED_PATH_MAX_LEN} (sufijo `…` si aplica).
 */
export function sanitizePathForLog(urlOrPath: string | undefined): string {
  if (urlOrPath == null || typeof urlOrPath !== 'string') {
    return '';
  }
  const noQueryFrag = urlOrPath.split('?')[0]?.split('#')[0] ?? '';
  if (noQueryFrag.length <= SANITIZED_PATH_MAX_LEN) {
    return noQueryFrag;
  }
  return `${noQueryFrag.slice(0, SANITIZED_PATH_MAX_LEN)}…`;
}
