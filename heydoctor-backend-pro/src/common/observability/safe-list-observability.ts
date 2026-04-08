import type { Logger } from '@nestjs/common';

export type SafeListFilters = Record<string, boolean>;

/**
 * JSON en una línea para agregadores (Railway) sin PII: sin IDs, emails, body ni tokens.
 */
export function logSafeList(
  logger: Logger,
  msg: string,
  opts: {
    page?: number;
    limit?: number;
    offset?: number;
    filters: SafeListFilters;
  },
): void {
  const row: Record<string, unknown> = { msg };
  if (opts.page !== undefined) row.page = opts.page;
  if (opts.limit !== undefined) row.limit = opts.limit;
  if (opts.offset !== undefined) row.offset = opts.offset;
  row.filters = opts.filters;
  logger.log(JSON.stringify(row));
}
