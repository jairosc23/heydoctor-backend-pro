/**
 * Llamadas al API Nest en otro origen (p. ej. Vercel → Railway).
 * Las cookies HttpOnly (`heydoctor_session`, `refresh_token`) solo se envían con credentials: 'include'.
 */
export const apiCredentialsInit: RequestInit = {
  credentials: 'include',
};
