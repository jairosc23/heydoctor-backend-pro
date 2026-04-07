import { heyDoctorTraceHeaders } from './heydoctor-trace-headers';

export type SendCallMetricsInput = {
  backendOrigin: string;
  accessToken: string;
  consultationId: string;
  /** One UUID per call session (client-generated). */
  callId: string;
  rtt?: number;
  packetsLost?: number;
  bitrate?: number;
  jitter?: number;
  packetLossRatio?: number;
  iceRestartEvents?: number;
  selectedCandidateType?: 'relay' | 'srflx' | 'host' | 'prflx' | 'unknown';
  /** scl | gru | bog | legacy | unknown — aligned with backend DTO. */
  turnRegion?: string;
};

/**
 * POST /api/webrtc/metrics — telemetry only (no media, no SDP).
 */
export async function sendCallMetrics(
  input: SendCallMetricsInput,
): Promise<void> {
  const {
    backendOrigin,
    accessToken,
    consultationId,
    callId,
    rtt,
    packetsLost,
    bitrate,
    jitter,
    packetLossRatio,
    iceRestartEvents,
    selectedCandidateType,
    turnRegion,
  } = input;

  const url = new URL('/api/webrtc/metrics', backendOrigin.replace(/\/$/, ''));

  const body: Record<string, unknown> = { consultationId };
  if (rtt !== undefined) body.rtt = rtt;
  if (packetsLost !== undefined) body.packetsLost = packetsLost;
  if (bitrate !== undefined) body.bitrate = bitrate;
  if (jitter !== undefined && !Number.isNaN(jitter)) body.jitter = jitter;
  if (packetLossRatio !== undefined) body.packetLossRatio = packetLossRatio;
  body.callId = callId;
  if (iceRestartEvents !== undefined) body.iceRestartEvents = iceRestartEvents;
  if (selectedCandidateType !== undefined) {
    body.selectedCandidateType = selectedCandidateType;
  }
  if (turnRegion !== undefined) body.turnRegion = turnRegion;

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...heyDoctorTraceHeaders(consultationId, callId),
    },
    credentials: 'include',
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `webrtc metrics ${res.status}: ${text.slice(0, 160)}`,
    );
  }
}
