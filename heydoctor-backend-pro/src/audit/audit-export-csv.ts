import type { AuditLog } from './audit-log.entity';

const HEADER =
  'userId,action,resource,resourceId,clinicId,status,httpStatus,createdAt';

function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Builds a CSV document for compliance export (UTF-8). */
export function formatAuditLogsAsCsv(rows: AuditLog[]): string {
  const lines = [HEADER];
  for (const row of rows) {
    lines.push(
      [
        escapeCsvCell(row.userId),
        escapeCsvCell(row.action),
        escapeCsvCell(row.resource),
        escapeCsvCell(row.resourceId),
        escapeCsvCell(row.clinicId),
        escapeCsvCell(row.status),
        escapeCsvCell(row.httpStatus),
        escapeCsvCell(row.createdAt.toISOString()),
      ].join(','),
    );
  }
  return lines.join('\r\n');
}
