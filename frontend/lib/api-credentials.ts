/**
 * Llamadas al API Nest en otro origen (p. ej. Vercel → Railway).
 * Cookie HttpOnly `refresh_token` (y CSRF) con credentials: 'include'; access JWT vía Bearer si aplica.
 * Usar siempre `...apiCredentialsInit` en cada `fetch` al backend (ver docs/VERCEL-FRONTEND-ROOT.md).
 */
export const apiCredentialsInit: RequestInit = {
  credentials: 'include',
};
