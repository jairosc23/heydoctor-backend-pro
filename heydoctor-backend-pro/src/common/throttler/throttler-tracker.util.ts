import type { Request } from 'express';
import { decode } from 'jsonwebtoken';

/**
 * Clave de throttling: IP + `sub` del JWT (sin verificar firma; solo conteo).
 * Si no hay Bearer válido decodificable, solo IP.
 */
export function throttlerTrackerIpAndOptionalUser(
  req: Record<string, unknown>,
): string {
  const r = req as unknown as Request;
  const ip = String(r.ip ?? r.socket?.remoteAddress ?? 'unknown');
  const auth = r.headers.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    const token = auth.slice('Bearer '.length).trim();
    if (token.length > 0) {
      try {
        const payload = decode(token) as { sub?: string } | null;
        if (payload && typeof payload.sub === 'string' && payload.sub) {
          return `th:${ip}:u:${payload.sub}`;
        }
      } catch {
        /* token ilegible */
      }
    }
  }
  return `th:${ip}`;
}
