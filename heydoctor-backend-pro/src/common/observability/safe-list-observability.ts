import type { Logger } from '@nestjs/common';

/**
 * JSON en una línea para agregadores (Railway) sin PII: sin IDs, emails, body ni tokens.
 * `ts` es ISO 8601 del servidor para correlación independiente del timestamp del proveedor.
 */
export function logSafeList(
  logger: Logger,
  data: {
    msg: string;
    page?: number;
    limit?: number;
    offset?: number;
    filters?: Record<string, boolean>;
  },
): void {
  logger.log(
    JSON.stringify({
      ...data,
      ts: new Date().toISOString(),
    }),
  );
}
