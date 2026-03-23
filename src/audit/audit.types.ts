export type AuditLogSuccessPayload = {
  userId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  clinicId?: string | null;
  httpStatus: number;
  metadata?: Record<string, unknown> | null;
};

export type AuditLogErrorPayload = {
  userId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  clinicId?: string | null;
  httpStatus: number;
  errorMessage: string | null;
  metadata?: Record<string, unknown> | null;
};
