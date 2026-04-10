/**
 * Atributos `SameSite=None` + `Secure` para cookies de auth/API en despliegues HTTPS.
 *
 * El front (Vercel) y el API (Railway) son orígenes distintos → el navegador solo envía
 * cookies en peticiones cross-site si SameSite=None y Secure=true.
 *
 * No confiar solo en NODE_ENV: en algunos despliegues no llega como `production` al proceso.
 */
export function useCrossSiteCookies(): boolean {
  const explicit = process.env.HEYDOCTOR_CROSS_SITE_COOKIES?.trim().toLowerCase();
  if (explicit === 'false' || explicit === '0') {
    return false;
  }
  if (explicit === 'true' || explicit === '1') {
    return true;
  }

  const onRailway =
    Boolean(process.env.RAILWAY_ENVIRONMENT?.trim()) ||
    Boolean(process.env.RAILWAY_PROJECT_ID?.trim()) ||
    Boolean(process.env.RAILWAY_SERVICE_ID?.trim()) ||
    Boolean(process.env.RAILWAY_PUBLIC_DOMAIN?.trim()) ||
    Boolean(process.env.RAILWAY_STATIC_URL?.trim());

  if (onRailway) {
    return true;
  }

  return process.env.NODE_ENV === 'production';
}
