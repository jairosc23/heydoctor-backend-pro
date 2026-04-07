export type ConnectionQuality = 'good' | 'weak' | 'poor' | 'reconnecting';

export function deriveConnectionQuality(params: {
  reconnecting: boolean;
  iceConnectionState: RTCIceConnectionState | null;
  lossRatio: number;
  rttMs?: number;
  outboundBitrateBps?: number;
  videoSuspendedForNetwork: boolean;
}): ConnectionQuality {
  const {
    reconnecting,
    iceConnectionState,
    lossRatio,
    rttMs,
    outboundBitrateBps,
    videoSuspendedForNetwork,
  } = params;

  if (reconnecting) {
    return 'reconnecting';
  }

  if (
    iceConnectionState === 'failed' ||
    iceConnectionState === 'disconnected'
  ) {
    return 'poor';
  }

  if (
    lossRatio > 0.1 ||
    (rttMs !== undefined && rttMs > 420) ||
    (!videoSuspendedForNetwork &&
      outboundBitrateBps !== undefined &&
      outboundBitrateBps > 0 &&
      outboundBitrateBps < 95_000)
  ) {
    return 'poor';
  }

  if (
    lossRatio > 0.035 ||
    (rttMs !== undefined && rttMs > 260)
  ) {
    return 'weak';
  }

  return 'good';
}
