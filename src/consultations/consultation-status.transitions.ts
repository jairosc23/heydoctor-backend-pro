import { ConsultationStatus } from './consultation-status.enum';

/** Single forward step allowed from each non-terminal status. */
const NEXT_STATUS: Partial<Record<ConsultationStatus, ConsultationStatus>> = {
  [ConsultationStatus.DRAFT]: ConsultationStatus.IN_PROGRESS,
  [ConsultationStatus.IN_PROGRESS]: ConsultationStatus.COMPLETED,
  [ConsultationStatus.COMPLETED]: ConsultationStatus.SIGNED,
  [ConsultationStatus.SIGNED]: ConsultationStatus.LOCKED,
};

/**
 * Returns true if `next` is a valid status change from `current`:
 * - same status (no-op), or
 * - exactly one allowed forward step in the clinical workflow.
 */
export function isValidTransition(
  current: ConsultationStatus,
  next: ConsultationStatus,
): boolean {
  if (current === next) {
    return true;
  }
  if (current === ConsultationStatus.LOCKED) {
    return false;
  }
  return NEXT_STATUS[current] === next;
}
