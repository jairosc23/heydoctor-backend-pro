/**
 * URL base del API HeyDoctor (Nest) y JWT stateless.
 * No usar NextAuth ni rutas tipo `/api/auth/csrf` en el origen de Next.
 */

export const HEYDOCTOR_ACCESS_TOKEN_STORAGE_KEY = 'heydoctor_access_token';

export type HeydoctorWindow = Window & { __API_URL__?: string };

export function getHeydoctorApiBase(): string {
  if (typeof window !== 'undefined') {
    const w = window as HeydoctorWindow;
    if (w.__API_URL__) return w.__API_URL__;
  }
  return (
    process.env.NEXT_PUBLIC_HEYDOCTOR_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    ''
  );
}

export function requireHeydoctorApiBase(): string {
  const base = getHeydoctorApiBase();
  if (!base) {
    throw new Error(
      'NEXT_PUBLIC_HEYDOCTOR_API_URL or NEXT_PUBLIC_API_URL must be configured',
    );
  }
  return base;
}

export function getStoredAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(HEYDOCTOR_ACCESS_TOKEN_STORAGE_KEY);
}

export function setStoredAccessToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(HEYDOCTOR_ACCESS_TOKEN_STORAGE_KEY, token);
}

export function clearStoredAccessToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(HEYDOCTOR_ACCESS_TOKEN_STORAGE_KEY);
}

export function requireAccessToken(): string {
  const token = getStoredAccessToken();
  if (!token) {
    throw new Error('No auth token available');
  }
  return token;
}

/** Headers para rutas protegidas del Nest (JwtAuthGuard). */
export function requireBearerHeaders(
  extra?: Record<string, string>,
): Record<string, string> {
  const token = requireAccessToken();
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
    ...extra,
  };
}
