import { apiCredentialsInit } from './api-credentials';
import { requireBearerHeaders } from './heydoctor-api';

export type PlatformGlobalMetrics = {
  windowDays: number;
  generatedAt: string;
  totals: {
    totalConsultations: number;
    activeCallsApprox: number;
    activeRecordingSessions: number;
    totalMetricSamples: number;
    averageQualityLabel: string;
    poorCallSamplePct: number | null;
    avgRttMs: number | null;
    turnUsage: {
      relayPct: number | null;
      directPct: number | null;
      samplesRelay: number;
      samplesDirect: number;
    };
  };
  alerts: Array<{ type: string; severity: string; message: string }>;
  byClinic: Array<{
    clinicId: string;
    clinicName: string;
    consultationsInWindow: number;
    totalConsultations: number;
    metricSamples: number;
    poorSamplePct: number | null;
    avgRttMs: number | null;
    averageQualityLabel: string;
    relayPct: number | null;
    directPct: number | null;
  }>;
  turnHealth: Array<{
    host: string;
    ok: boolean;
    latencyMs: number | null;
    checkedAtIso: string;
  }>;
};

export async function fetchPlatformGlobalMetrics(params: {
  backendOrigin: string;
  windowDays?: number;
}): Promise<PlatformGlobalMetrics> {
  const { backendOrigin, windowDays = 7 } = params;
  const url = new URL(
    '/api/platform/metrics/global',
    backendOrigin.replace(/\/$/, ''),
  );
  url.searchParams.set('windowDays', String(windowDays));
  const res = await fetch(url.toString(), {
    ...apiCredentialsInit,
    headers: requireBearerHeaders(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`platform global ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as PlatformGlobalMetrics;
}
