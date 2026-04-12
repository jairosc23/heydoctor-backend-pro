/**
 * Llamadas al API Nest en otro origen (p. ej. Vercel → Railway).
 * Autenticación principal: JWT en `Authorization: Bearer` (ver `heydoctor-api.ts`).
 * `credentials: 'include'` por si el backend también envía cookies HttpOnly (p. ej. refresh).
 */
export const apiCredentialsInit: RequestInit = {
  credentials: 'include',
};
