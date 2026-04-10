/**
 * Dominio explícito para Set-Cookie (compartido entre subdominios de HeyDoctor).
 * El host de la respuesta debe ser un subdominio de `heydoctor.health` (p. ej. `pro-api.heydoctor.health`).
 */
export const AUTH_COOKIE_DOMAIN = '.heydoctor.health';
