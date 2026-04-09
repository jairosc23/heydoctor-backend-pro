import { heyDoctorTraceHeaders } from './heydoctor-trace-headers';

export type RecordingApiInput = {
  backendOrigin: string;
  consultationId: string;
  callId: string;
  userConsent: boolean;
};

export type RecordingStartResult = {
  ok: true;
  accepted: true;
  mode: string;
  recordingId: string;
  consultationId: string;
  userId: string;
  consentRequired: boolean;
  userConsentAsserted: boolean;
  storagePath: string | null;
  encryptionKeyId: string | null;
  startedAt: string;
};

export type RecordingStopResult = {
  ok: true;
  accepted: true;
  mode: string;
  recordingId: string;
  consultationId: string;
  userId: string;
  consentRequired: boolean;
  userConsentAsserted: boolean;
  endedAt: string;
};

function postHeaders(consultationId: string, callId: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...heyDoctorTraceHeaders(consultationId, callId),
  };
}

function getHeaders(consultationId: string, callId: string): Record<string, string> {
  return {
    Accept: 'application/json',
    ...heyDoctorTraceHeaders(consultationId, callId),
  };
}

export async function requestRecordingStart(
  input: RecordingApiInput,
): Promise<RecordingStartResult> {
  const url = new URL(
    '/api/webrtc/recording/start',
    input.backendOrigin.replace(/\/$/, ''),
  );
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: postHeaders(input.consultationId, input.callId),
    credentials: 'include',
    body: JSON.stringify({
      consultationId: input.consultationId,
      userConsent: input.userConsent,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`recording/start ${res.status}: ${text.slice(0, 160)}`);
  }
  return (await res.json()) as RecordingStartResult;
}

export async function requestRecordingStop(
  input: RecordingApiInput,
): Promise<RecordingStopResult> {
  const url = new URL(
    '/api/webrtc/recording/stop',
    input.backendOrigin.replace(/\/$/, ''),
  );
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: postHeaders(input.consultationId, input.callId),
    credentials: 'include',
    body: JSON.stringify({
      consultationId: input.consultationId,
      userConsent: input.userConsent,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`recording/stop ${res.status}: ${text.slice(0, 160)}`);
  }
  return (await res.json()) as RecordingStopResult;
}

export type RecordingStatusResult = {
  active: boolean;
  recording: {
    recordingId: string;
    consultationId: string;
    status: string;
    startedByUserId: string;
    consentRequired: boolean;
    userConsentAsserted: boolean;
    storagePath: string | null;
    encryptionKeyId: string | null;
    startedAt: string;
    endedAt: string | null;
  } | null;
};

export async function fetchRecordingStatus(params: {
  backendOrigin: string;
  consultationId: string;
  callId: string;
}): Promise<RecordingStatusResult> {
  const url = new URL(
    '/api/webrtc/recording/status',
    params.backendOrigin.replace(/\/$/, ''),
  );
  url.searchParams.set('consultationId', params.consultationId);
  const res = await fetch(url.toString(), {
    headers: getHeaders(params.consultationId, params.callId),
    credentials: 'include',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`recording/status ${res.status}: ${text.slice(0, 160)}`);
  }
  return (await res.json()) as RecordingStatusResult;
}
