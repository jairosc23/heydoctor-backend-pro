/**
 * Controls application-level log emission when an audit row is persisted.
 * DB audit rows are always written; this only gates noisy `logger.log('Audit log created', ...)`.
 *
 * Env:
 * - `LOG_AUDIT=false` — never emit that line (errors from AuditService still log via `.error()`).
 * - `LOG_AUDIT=true` — emit for every persisted audit row (includes lists/reads; verbose).
 * - unset — default: emit only “high signal” actions (mutations / security / exports), skip read-like patterns.
 *
 * Future scale: optionally push these events to a queue instead of sync console (see AuditService TODO).
 */
export function isLowSignalAuditAction(action: string): boolean {
  if (action === 'HEALTH_CHECK' || action === 'AUTH_ME') {
    return true;
  }
  if (/_READ$/.test(action) || /_LIST$/.test(action)) {
    return true;
  }
  if (
    action === 'METRICS_ROLLING_READ' ||
    action === 'CONSENT_STATUS_CHECK' ||
    action === 'GDPR_DELETION_STATUS'
  ) {
    return true;
  }
  return false;
}

/** Whether to emit structured app log after a successful audit row insert. */
export function shouldEmitAuditPersistSuccessLog(action: string): boolean {
  if (process.env.LOG_AUDIT === 'false') {
    return false;
  }
  if (process.env.LOG_AUDIT === 'true') {
    return true;
  }
  return !isLowSignalAuditAction(action);
}

/** Persisted audit failure rows are always echoed unless LOG_AUDIT=false (rarely set in prod for errors). */
export function shouldEmitAuditPersistErrorLog(): boolean {
  return process.env.LOG_AUDIT !== 'false';
}
