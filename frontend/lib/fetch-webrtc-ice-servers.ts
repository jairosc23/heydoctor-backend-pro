/**
 * Fetches ephemeral ICE servers (STUN/TURN) from the Nest API.
 * TURN credentials must never be static in the client bundle.
 * Auth: JWT Bearer + optional cookies (credentials: 'include').
 */

import { apiCredentialsInit } from './api-credentials';
import { heyDoctorTraceHeaders } from './heydoctor-trace-headers';
import { requireBearerHeaders } from './heydoctor-api';

export type IceServersResponse = {
  iceServers: RTCIceServer[];
};

export async function fetchWebrtcIceServers(params: {
  backendOrigin: string;
  consultationId: string;
  callId: string;
}): Promise<RTCIceServer[]> {
  const { backendOrigin, consultationId, callId } = params;
  const url = new URL('/api/webrtc/ice-servers', backendOrigin.replace(/\/$/, ''));
  url.searchParams.set('consultationId', consultationId);

  const res = await fetch(url.toString(), {
    ...apiCredentialsInit,
    method: 'GET',
    headers: {
      ...requireBearerHeaders(),
      ...heyDoctorTraceHeaders(consultationId, callId),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `ice-servers failed: ${res.status} ${text.slice(0, 200)}`,
    );
  }

  const data = (await res.json()) as IceServersResponse;
  if (!data || !Array.isArray(data.iceServers)) {
    throw new Error('ice-servers: invalid response shape');
  }
  return data.iceServers;
}
