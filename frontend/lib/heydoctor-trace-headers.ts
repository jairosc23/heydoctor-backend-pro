/** HTTP headers for enterprise request correlation (matches Nest RequestIdMiddleware). */

export const HEADER_HEY_DOCTOR_CONSULTATION_ID = 'X-HeyDoctor-Consultation-Id';
export const HEADER_HEY_DOCTOR_CALL_ID = 'X-HeyDoctor-Call-Id';

export function heyDoctorTraceHeaders(
  consultationId: string,
  callId: string,
): Record<string, string> {
  return {
    [HEADER_HEY_DOCTOR_CONSULTATION_ID]: consultationId,
    [HEADER_HEY_DOCTOR_CALL_ID]: callId,
  };
}
