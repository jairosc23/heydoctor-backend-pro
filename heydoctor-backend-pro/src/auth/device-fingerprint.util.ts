import { createHash } from 'crypto';

/** Hash estable del UA (minúsculas, trim, tope) para correlación sin guardar PII cruda extendida. */
export function computeDeviceHash(
  userAgent: string | null | undefined,
): string {
  const normalized = (userAgent ?? '').trim().toLowerCase().slice(0, 2048);
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}

/** Etiqueta legible tipo "Chrome on Mac" (sin librerías). */
export function formatDeviceLabel(
  userAgent: string | null | undefined,
): string {
  const ua = (userAgent ?? '').trim();
  if (!ua) {
    return 'Unknown device';
  }
  let browser = 'Browser';
  if (/Edg(?:e|A|iOS)?\//.test(ua)) {
    browser = 'Edge';
  } else if (/OPR\//.test(ua) || /Opera/.test(ua)) {
    browser = 'Opera';
  } else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) {
    browser = 'Chrome';
  } else if (/Firefox\//.test(ua)) {
    browser = 'Firefox';
  } else if (/Safari\//.test(ua) && !/Chrome|Chromium/.test(ua)) {
    browser = 'Safari';
  }

  let os = '';
  if (/iPhone|iPad|iPod/.test(ua)) {
    os = 'iOS';
  } else if (/Android/.test(ua)) {
    os = 'Android';
  } else if (/Mac OS X|Macintosh/.test(ua)) {
    os = 'Mac';
  } else if (/Windows/.test(ua)) {
    os = 'Windows';
  } else if (/Linux/.test(ua)) {
    os = 'Linux';
  }

  return os ? `${browser} on ${os}` : browser;
}

/** IP enmascarada para listados (no exponer dirección completa). */
export function maskIpForSessionList(ip: string | null | undefined): string {
  if (!ip?.trim()) {
    return '—';
  }
  const s = ip.trim();
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(s)) {
    const p = s.split('.');
    return `${p[0]}.${p[1]}.*.*`;
  }
  if (s.includes(':')) {
    const parts = s.split(':').filter(Boolean);
    if (parts.length >= 1) {
      return `${parts[0]}:…`;
    }
  }
  return `${createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 12)}…`;
}
