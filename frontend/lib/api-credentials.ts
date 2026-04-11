/**
 * Llamadas al API Nest en otro origen (p. ej. Vercel → Railway).
 * Las cookies HttpOnly (`heydoctor_session`, `refresh_token`) solo se envían con credentials: 'include'.
 * Usar siempre `...apiCredentialsInit` en cada `fetch` al backend (ver docs/VERCEL-FRONTEND-ROOT.md).
 */
export const apiCredentialsInit: RequestInit = {
  credentials: 'include',
};
