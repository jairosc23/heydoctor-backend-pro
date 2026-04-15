/** Reduce cardinalidad de labels Prometheus (UUIDs e IDs numéricos en segmentos). */
export function normalizePathForMetrics(url: string): string {
  let path = (url.split('?')[0] ?? '').split('#')[0] ?? '';
  path = path.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    ':id',
  );
  // Segmentos solo numéricos (p. ej. /resource/42); no afecta /v1 (el segmento es "v1").
  return path.replace(/\/\d+(?=\/|$)/g, '/:id');
}
