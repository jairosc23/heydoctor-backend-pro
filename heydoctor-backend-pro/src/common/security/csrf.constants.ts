/** Cookie de doble envío (legible por el cliente vía JSON en responses; el navegador la envía en cada /api con credentials). */
export const CSRF_COOKIE_NAME = 'csrf_token';
export const CSRF_HEADER_NAME = 'x-csrf-token';
