/**
 * TTL tipo vercel/ms: 15m, 7d, 3600s (sin dependencia externa).
 */

const DURATION = /^(\d+)\s*(ms|s|m|h|d|w)$/i;

/** Valida y devuelve el literal para `JwtService` `expiresIn` (string o número en segundos). */
export function normalizeJwtExpiresIn(
  raw: string | undefined,
  fallback: string,
): string {
  const s = raw?.trim() ?? '';
  return DURATION.test(s) ? s : fallback;
}

/** Milisegundos desde el mismo formato (p. ej. maxAge de cookie, `expiresAt` en DB). */
export function jwtTtlToMs(raw: string | undefined, fallbackMs: number): number {
  const spec = raw?.trim() ?? '';
  const match = DURATION.exec(spec);
  if (!match) {
    return fallbackMs;
  }
  const n = Number.parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const mult: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
    w: 604_800_000,
  };
  const m = mult[unit];
  return m != null && Number.isFinite(n) ? n * m : fallbackMs;
}
