export type RecordingApiInput = {
  backendOrigin: string;
  accessToken: string;
  consultationId: string;
  userConsent: boolean;
};

export async function requestRecordingStart(
  input: RecordingApiInput,
): Promise<void> {
  const url = new URL(
    '/api/webrtc/recording/start',
    input.backendOrigin.replace(/\/$/, ''),
  );
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'application/json',
    },
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
}

export async function requestRecordingStop(
  input: RecordingApiInput,
): Promise<void> {
  const url = new URL(
    '/api/webrtc/recording/stop',
    input.backendOrigin.replace(/\/$/, ''),
  );
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'application/json',
    },
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
}
