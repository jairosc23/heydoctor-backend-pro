import type { Request } from 'express';

/** IP y User-Agent para auditoría HIPAA / trazas de seguridad. */
export function extractClientHttpMeta(req: Request): {
  ip: string | null;
  userAgent: string | null;
} {
  const forwarded = req.headers['x-forwarded-for'];
  const ip =
    typeof forwarded === 'string'
      ? forwarded.split(',')[0].trim()
      : (req.ip ?? null);
  const userAgent =
    (req.headers['user-agent'] as string | undefined) ?? null;
  return { ip, userAgent };
}
