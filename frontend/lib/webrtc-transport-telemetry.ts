/**
 * Derives transport fields for PostWebrtcMetricsDto (relay/srflx/host/prflx, turn region).
 * Uses the same host→region heuristics as the backend `inferRegionLabelFromHost`.
 */

import { rtcStatsReportGet } from './rtc-stats-report-get';

export type SelectedCandidateType = 'relay' | 'srflx' | 'host' | 'prflx' | 'unknown';

function inferTurnRegionFromIceUrl(url: string): string {
  const m = /^(?:turn|turns):([^:?]+)/i.exec(url.trim());
  const host = (m?.[1] ?? '').toLowerCase();
  if (host.includes('turn-scl')) return 'scl';
  if (host.includes('turn-gru')) return 'gru';
  if (host.includes('turn-bog')) return 'bog';
  if (host.includes('heydoctor')) return 'legacy';
  return 'unknown';
}

/**
 * Reads nominated successful pair from an existing getStats() report (no extra RTT).
 */
export function extractSelectedTransportFromStats(report: RTCStatsReport): {
  selectedCandidateType?: SelectedCandidateType;
  turnRegion?: string;
} {
  let localCandidateId: string | undefined;
  report.forEach((s) => {
    if (s.type !== 'candidate-pair') return;
    const p = s as RTCIceCandidatePairStats;
    if (p.nominated !== true || p.state !== 'succeeded') return;
    if (typeof p.localCandidateId === 'string') {
      localCandidateId = p.localCandidateId;
    }
  });

  if (!localCandidateId) {
    return {};
  }

  const local = rtcStatsReportGet(report, localCandidateId);
  if (!local || local.type !== 'local-candidate') {
    return {};
  }

  const cand = local as RTCStats & {
    candidateType?: RTCIceCandidateType;
    url?: string;
  };
  const rawType = cand.candidateType;
  let selectedCandidateType: SelectedCandidateType = 'unknown';
  if (
    rawType === 'relay' ||
    rawType === 'srflx' ||
    rawType === 'host' ||
    rawType === 'prflx'
  ) {
    selectedCandidateType = rawType;
  }

  let turnRegion: string | undefined;
  if (rawType === 'relay') {
    const u = cand.url;
    if (typeof u === 'string' && u.length > 0) {
      turnRegion = inferTurnRegionFromIceUrl(u);
    }
  }

  return { selectedCandidateType, turnRegion };
}
