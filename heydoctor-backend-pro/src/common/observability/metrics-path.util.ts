/** Reduce cardinalidad de labels Prometheus (sustituye UUIDs). */
export function normalizePathForMetrics(url: string): string {
  const path = (url.split('?')[0] ?? '').split('#')[0] ?? '';
  return path.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    ':id',
  );
}
