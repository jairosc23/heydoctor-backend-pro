/**
 * Default rolling window for platform / WebRTC quality aggregations and admin dashboards.
 * Use these instead of scattering literal `7` or `90` across services.
 */
export const DEFAULT_ANALYTICS_WINDOW_DAYS = 7;
export const MIN_ANALYTICS_WINDOW_DAYS = 1;
export const MAX_ANALYTICS_WINDOW_DAYS = 90;
