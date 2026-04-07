'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  deriveConnectionQuality,
  type ConnectionQuality,
} from '../lib/webrtc-connection-quality';
import { fetchWebrtcIceServers } from '../lib/fetch-webrtc-ice-servers';
import { requestRecordingStart, requestRecordingStop } from '../lib/webrtc-recording-api';
import { sendCallMetrics } from '../lib/send-webrtc-metrics';
import type { Socket } from 'socket.io-client';
import { io } from 'socket.io-client';

/** Production-oriented RTCPeerConnection defaults (broad browser support). */
export function createProRtcConfiguration(
  iceServers: RTCIceServer[],
): RTCConfiguration {
  return {
    iceServers,
    iceTransportPolicy: 'all',
    iceCandidatePoolSize: 8,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
  };
}

export const DEFAULT_CALL_CONSTRAINTS: MediaStreamConstraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  video: {
    width: { ideal: 1280, max: 1280 },
    height: { ideal: 720, max: 720 },
    frameRate: { ideal: 24, max: 30 },
    facingMode: 'user',
  },
};

type AdaptationTier = 0 | 1 | 2;

/** Bitrate / resolution ladder: higher index = more aggressive save for poor networks */
const VIDEO_TIERS: Array<{
  maxBitrate: number;
  maxFramerate: number;
  scaleResolutionDownBy: number;
}> = [
  { maxBitrate: 1_400_000, maxFramerate: 30, scaleResolutionDownBy: 1 },
  { maxBitrate: 550_000, maxFramerate: 24, scaleResolutionDownBy: 1.5 },
  { maxBitrate: 280_000, maxFramerate: 15, scaleResolutionDownBy: 2 },
];

const AUDIO_FLOOR_BITRATE = 32_000;

async function applyVideoTier(
  videoSender: RTCRtpSender | undefined,
  tier: AdaptationTier,
): Promise<void> {
  if (!videoSender) return;
  const params = videoSender.getParameters();
  if (!params.encodings || params.encodings.length === 0) {
    params.encodings = [{}];
  }

  const t = VIDEO_TIERS[tier];
  const next = params.encodings.map((enc) => ({
    ...enc,
    maxBitrate: t.maxBitrate,
    maxFramerate: t.maxFramerate,
    scaleResolutionDownBy: t.scaleResolutionDownBy,
  }));
  params.encodings = next;
  await videoSender.setParameters(params);
}

async function prioritizeAudioOverVideo(
  pc: RTCPeerConnection,
  videoTier: AdaptationTier,
): Promise<void> {
  const senders = pc.getSenders();
  const audioSender = senders.find((s) => s.track?.kind === 'audio');
  const videoSender = senders.find((s) => s.track?.kind === 'video');

  if (audioSender) {
    const p = audioSender.getParameters();
    const encodings =
      p.encodings?.length ? p.encodings : [{} as RTCRtpEncodingParameters];
    p.encodings = encodings.map((enc) => ({
      ...enc,
      priority: 'high',
      networkPriority: 'high',
      maxBitrate: Math.max(enc.maxBitrate ?? 64_000, AUDIO_FLOOR_BITRATE),
    }));
    try {
      await audioSender.setParameters(p);
    } catch {
      /* ignore if browser ignores priority fields */
    }
  }

  await applyVideoTier(videoSender, videoTier);
}

export type NetworkStatsSample = {
  timestamp: number;
  packetsLost: number;
  packetsSent: number;
  jitter: number;
  roundTripTime?: number;
  availableOutgoingBitrate?: number;
  bytesSent?: number;
};

function parseOutboundVideoStats(
  report: RTCStatsReport,
): Partial<NetworkStatsSample> {
  let packetsLost = 0;
  let packetsSent = 0;
  let jitter = 0;
  let bytesSent = 0;
  let outboundVideoId: string | undefined;

  report.forEach((s) => {
    if (s.type === 'outbound-rtp' && 'kind' in s && s.kind === 'video') {
      outboundVideoId = s.id;
      const o = s as RTCOutboundRtpStreamStats & {
        packetsSent?: number;
        bytesSent?: number;
      };
      if (typeof o.packetsLost === 'number') packetsLost = o.packetsLost;
      if (typeof o.packetsSent === 'number') packetsSent = o.packetsSent;
      if (typeof o.bytesSent === 'number') bytesSent = o.bytesSent;
      if ('jitter' in o && typeof o.jitter === 'number') jitter = o.jitter;
    }
  });

  let roundTripTime: number | undefined;
  let availableOutgoingBitrate: number | undefined;

  if (outboundVideoId) {
    const ob = report.get(outboundVideoId);
    const rid =
      ob &&
      'remoteId' in ob &&
      typeof (ob as { remoteId?: string }).remoteId === 'string'
        ? (ob as { remoteId: string }).remoteId
        : undefined;
    if (rid) {
      const remote = report.get(rid);
      if (remote?.type === 'remote-inbound-rtp') {
        const r = remote as RTCRemoteInboundRtpStreamStats;
        if (typeof r.packetsLost === 'number') packetsLost = r.packetsLost;
        if (typeof r.jitter === 'number') jitter = r.jitter;
        if (typeof r.roundTripTime === 'number') {
          roundTripTime = r.roundTripTime * 1000;
        }
      }
    }
  }

  report.forEach((s) => {
    if (s.type === 'candidate-pair' && 'state' in s) {
      const p = s as RTCIceCandidatePairStats;
      if (p.nominated === true && p.state === 'succeeded') {
        if (roundTripTime === undefined && typeof p.currentRoundTripTime === 'number') {
          roundTripTime = p.currentRoundTripTime * 1000;
        }
        if (typeof p.availableOutgoingBitrate === 'number') {
          availableOutgoingBitrate = p.availableOutgoingBitrate;
        }
      }
    }
  });

  return {
    timestamp: Date.now(),
    packetsLost,
    packetsSent,
    jitter,
    roundTripTime,
    availableOutgoingBitrate,
    bytesSent,
  };
}

/**
 * Poll getStats and move video quality tier up/down.
 * Prioritizes audio by lowering video before touching audio.
 */
export function createAdaptiveVideoMonitor(
  pc: RTCPeerConnection,
  getVideoSender: () => RTCRtpSender | undefined,
  options?: {
    intervalMs?: number;
    onTierChange?: (tier: AdaptationTier) => void;
    onStatsSample?: (payload: {
      snap: NetworkStatsSample & { outboundBitrateBps?: number };
      lossRatio: number;
    }) => void | Promise<void>;
  },
): () => void {
  const intervalMs = options?.intervalMs ?? 2500;
  let tier: AdaptationTier = 0;
  let prevLost = 0;
  let stableCycles = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  let bitrateAcc = { lastBytes: 0, lastTs: 0 };

  const tick = async () => {
    try {
      const report = await pc.getStats();
      const snap = parseOutboundVideoStats(report);
      const lost = snap.packetsLost ?? 0;
      const sent = snap.packetsSent ?? 0;
      const deltaLost = lost - prevLost;
      const rtt = snap.roundTripTime;
      const outBr = snap.availableOutgoingBitrate;
      const bytes = snap.bytesSent ?? 0;

      let outboundBitrateBps: number | undefined;
      if (bitrateAcc.lastTs > 0) {
        const dt = (Date.now() - bitrateAcc.lastTs) / 1000;
        if (dt >= 0.2 && bytes >= bitrateAcc.lastBytes) {
          outboundBitrateBps = (8 * (bytes - bitrateAcc.lastBytes)) / dt;
        }
      }
      bitrateAcc = { lastBytes: bytes, lastTs: Date.now() };

      prevLost = lost;

      const lossRatio =
        sent + deltaLost > 0 ? deltaLost / (sent + deltaLost + 1) : 0;

      const fullSnap: NetworkStatsSample & {
        outboundBitrateBps?: number;
      } = {
        timestamp: snap.timestamp ?? Date.now(),
        packetsLost: lost,
        packetsSent: sent,
        jitter: snap.jitter ?? 0,
        roundTripTime: snap.roundTripTime,
        availableOutgoingBitrate: snap.availableOutgoingBitrate,
        bytesSent: snap.bytesSent,
        outboundBitrateBps,
      };

      await options?.onStatsSample?.({ snap: fullSnap, lossRatio });

      let downgrade = false;
      if (lossRatio > 0.08 && deltaLost > 2) downgrade = true;
      if (rtt !== undefined && rtt > 450) downgrade = true;
      if (outBr !== undefined && outBr < 250_000 && tier === 0) downgrade = true;

      if (downgrade && tier < 2) {
        tier = (tier + 1) as AdaptationTier;
        stableCycles = 0;
        await applyVideoTier(getVideoSender(), tier);
        options?.onTierChange?.(tier);
      } else if (
        !downgrade &&
        lossRatio < 0.02 &&
        (rtt === undefined || rtt < 200) &&
        (outBr === undefined || outBr > 600_000)
      ) {
        stableCycles += 1;
        if (stableCycles >= 4 && tier > 0) {
          tier = (tier - 1) as AdaptationTier;
          stableCycles = 0;
          await applyVideoTier(getVideoSender(), tier);
          options?.onTierChange?.(tier);
        }
      } else {
        stableCycles = 0;
      }
    } catch {
      /* ignore */
    }
  };

  timer = setInterval(() => void tick(), intervalMs);
  void tick();

  return () => {
    if (timer) clearInterval(timer);
    timer = null;
  };
}

export type UseTelemedicineCallOptions = {
  consultationId: string;
  /** Emite la oferta inicial y, por defecto, los ICE restart (evita glare en 1:1). */
  isInitiator: boolean;
  accessToken: string;
  /** Origen del API, p.ej. https://xxx.up.railway.app */
  backendOrigin: string;
  /** Socket.IO path if no estándar (Nest default: /socket.io) */
  socketPath?: string;
  /** Si ya tienes un socket al namespace /webrtc, pásalo y no se creará otro */
  externalSocket?: Socket | null;
  mediaConstraints?: MediaStreamConstraints;
  /** Solo el lado iniciador ejecuta ICE restart automático */
  iceRestartInitiatorOnly?: boolean;
  disconnectedIceRestartMs?: number;
  onError?: (message: string) => void;
  onConnectionState?: (state: RTCPeerConnectionState) => void;
  onIceConnectionState?: (state: RTCIceConnectionState) => void;
  onRemoteUserId?: (userId: string | null) => void;
  onVideoTierChange?: (tier: AdaptationTier) => void;
  /** default true — POST /api/webrtc/metrics cada ~7.5s (ticks de 2.5s × 3) */
  sendCallMetricsToBackend?: boolean;
};

export type UseTelemedicineCallResult = {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  connectionState: RTCPeerConnectionState | null;
  iceConnectionState: RTCIceConnectionState | null;
  videoTier: AdaptationTier;
  connectionQuality: ConnectionQuality | null;
  /** Vídeo detenido en envío por política de red (audio activo). */
  videoSuspendedForNetwork: boolean;
  startCall: () => Promise<void>;
  endCall: () => void;
  startRecording: (userConsent: boolean) => Promise<void>;
  stopRecording: (userConsent: boolean) => Promise<void>;
};

/**
 * Hook de videollamada 1:1 compatible con el gateway Nest:
 * join-consultation, offer, answer, ice-candidate (Socket.IO namespace /webrtc).
 */
export function useTelemedicineCall(
  options: UseTelemedicineCallOptions,
): UseTelemedicineCallResult {
  const {
    consultationId,
    isInitiator,
    accessToken,
    backendOrigin,
    socketPath = '/socket.io',
    externalSocket = null,
    mediaConstraints = DEFAULT_CALL_CONSTRAINTS,
    iceRestartInitiatorOnly = true,
    disconnectedIceRestartMs = 8000,
    onError,
    onConnectionState,
    onIceConnectionState,
    onRemoteUserId,
    onVideoTierChange,
    sendCallMetricsToBackend = true,
  } = options;

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] =
    useState<RTCPeerConnectionState | null>(null);
  const [iceConnectionState, setIceConnectionState] =
    useState<RTCIceConnectionState | null>(null);
  const [videoTier, setVideoTier] = useState<AdaptationTier>(0);
  const [connectionQuality, setConnectionQuality] = useState<
    ConnectionQuality | null
  >(null);
  const [videoSuspendedForNetwork, setVideoSuspendedForNetwork] =
    useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const ownSocketRef = useRef(false);
  const stopStatsRef = useRef<(() => void) | null>(null);
  const videoTierRef = useRef<AdaptationTier>(0);
  const remoteIdRef = useRef<string | null>(null);
  const makingOfferRef = useRef(false);
  const iceRestartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const disconnectedSinceRef = useRef<number | null>(null);
  const disconnectedPollRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  const remoteStreamRef = useRef<MediaStream | null>(null);
  const iceConnectionStateRef = useRef<RTCIceConnectionState | null>(null);
  const reconnectingIceRef = useRef(false);
  const capturedVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const videoSuspendedByPolicyRef = useRef(false);
  const metricsSamplesRef = useRef(0);
  const poorNetworkStreakRef = useRef(0);
  const goodNetworkStreakRef = useRef(0);
  const lastQualityInputsRef = useRef<Parameters<
    typeof deriveConnectionQuality
  >[0] | null>(null);

  useEffect(() => {
    videoTierRef.current = videoTier;
  }, [videoTier]);

  const detachMonitor = useCallback(() => {
    if (stopStatsRef.current) {
      stopStatsRef.current();
      stopStatsRef.current = null;
    }
    if (iceRestartTimerRef.current) {
      clearTimeout(iceRestartTimerRef.current);
      iceRestartTimerRef.current = null;
    }
    if (disconnectedPollRef.current) {
      clearInterval(disconnectedPollRef.current);
      disconnectedPollRef.current = null;
    }
  }, []);

  const runIceRestart = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || makingOfferRef.current) return;
    if (iceRestartInitiatorOnly && !isInitiator) return;
    if (pc.signalingState !== 'stable') return;

    reconnectingIceRef.current = true;
    setConnectionQuality('reconnecting');

    makingOfferRef.current = true;
    try {
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      socketRef.current?.emit('offer', {
        consultationId,
        sdp: pc.localDescription,
      });
    } catch (e) {
      onError?.((e as Error).message);
    } finally {
      makingOfferRef.current = false;
    }
  }, [consultationId, iceRestartInitiatorOnly, isInitiator, onError]);

  const scheduleIceRestartDebounced = useCallback(() => {
    if (iceRestartTimerRef.current) return;
    iceRestartTimerRef.current = setTimeout(() => {
      iceRestartTimerRef.current = null;
      void runIceRestart();
    }, 1500);
  }, [runIceRestart]);

  const wirePeerConnection = useCallback(
    (pc: RTCPeerConnection) => {
      pc.onsignalingstatechange = () => {
        if (pc.signalingState === 'stable') {
          void prioritizeAudioOverVideo(pc, videoTierRef.current);
        }
      };

      pc.onconnectionstatechange = () => {
        const s = pc.connectionState;
        setConnectionState(s);
        onConnectionState?.(s);
        if (s === 'failed') {
          scheduleIceRestartDebounced();
        }
      };

      pc.oniceconnectionstatechange = () => {
        const s = pc.iceConnectionState;
        iceConnectionStateRef.current = s;
        setIceConnectionState(s);
        onIceConnectionState?.(s);

        if (s === 'connected' || s === 'completed') {
          reconnectingIceRef.current = false;
          const last = lastQualityInputsRef.current;
          if (last) {
            setConnectionQuality(
              deriveConnectionQuality({
                ...last,
                reconnecting: false,
                iceConnectionState: s,
              }),
            );
          }
        }

        if (s === 'failed') {
          scheduleIceRestartDebounced();
        } else if (s === 'disconnected') {
          disconnectedSinceRef.current = disconnectedSinceRef.current ?? Date.now();
        } else {
          disconnectedSinceRef.current = null;
        }
      };

      pc.onicecandidate = (event) => {
        if (!event.candidate || !socketRef.current) return;
        socketRef.current.emit('ice-candidate', {
          consultationId,
          candidate: event.candidate.toJSON(),
        });
      };

      pc.ontrack = (ev) => {
        const [first] = ev.streams;
        const next =
          remoteStreamRef.current ??
          new MediaStream();
        if (ev.track && !next.getTracks().includes(ev.track)) {
          next.addTrack(ev.track);
        }
        remoteStreamRef.current = first ?? next;
        setRemoteStream(remoteStreamRef.current);
      };

      if (disconnectedPollRef.current) {
        clearInterval(disconnectedPollRef.current);
      }
      disconnectedPollRef.current = window.setInterval(() => {
        if (pc.iceConnectionState !== 'disconnected') return;
        const since = disconnectedSinceRef.current;
        if (
          since &&
          Date.now() - since > disconnectedIceRestartMs &&
          (isInitiator || !iceRestartInitiatorOnly)
        ) {
          disconnectedSinceRef.current = null;
          void runIceRestart();
        }
      }, 2000);
    },
    [
      consultationId,
      disconnectedIceRestartMs,
      iceRestartInitiatorOnly,
      isInitiator,
      onConnectionState,
      onIceConnectionState,
      runIceRestart,
      scheduleIceRestartDebounced,
    ],
  );

  const attachSignalingHandlers = useCallback(
    (socket: Socket, pc: RTCPeerConnection) => {
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
      socket.off('peer-joined');
      socket.off('peer-left');

      socket.on('peer-joined', async ({ userId }: { userId: string }) => {
        remoteIdRef.current = userId;
        onRemoteUserId?.(userId);
        if (!isInitiator || makingOfferRef.current) return;
        if (pc.signalingState !== 'stable') return;
        makingOfferRef.current = true;
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('offer', {
            consultationId,
            sdp: pc.localDescription,
          });
        } catch (e) {
          onError?.((e as Error).message);
        } finally {
          makingOfferRef.current = false;
        }
      });

      socket.on(
        'offer',
        async ({
          sdp,
          fromUserId,
        }: {
          sdp: RTCSessionDescriptionInit;
          fromUserId: string;
        }) => {
          remoteIdRef.current = fromUserId;
          onRemoteUserId?.(fromUserId);
          try {
            if (sdp.type === 'offer') {
              if (pc.signalingState !== 'stable') {
                await Promise.all([
                  pc.setLocalDescription({ type: 'rollback' }),
                ]).catch(() => undefined);
              }
              await pc.setRemoteDescription(new RTCSessionDescription(sdp));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              socket.emit('answer', {
                consultationId,
                sdp: pc.localDescription,
              });
            }
          } catch (e) {
            onError?.((e as Error).message);
          }
        },
      );

      socket.on(
        'answer',
        async ({
          sdp,
        }: {
          sdp: RTCSessionDescriptionInit;
          fromUserId: string;
        }) => {
          try {
            if (pc.signalingState === 'have-local-offer') {
              await pc.setRemoteDescription(new RTCSessionDescription(sdp));
            }
          } catch (e) {
            onError?.((e as Error).message);
          }
        },
      );

      socket.on(
        'ice-candidate',
        async ({
          candidate,
        }: {
          candidate: RTCIceCandidateInit;
          fromUserId: string;
        }) => {
          try {
            if (candidate && pc.remoteDescription) {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            }
          } catch {
            /* ignore stale candidates */
          }
        },
      );

      socket.on('peer-left', () => {
        remoteIdRef.current = null;
        onRemoteUserId?.(null);
      });
    },
    [consultationId, isInitiator, onError, onRemoteUserId],
  );

  const endCall = useCallback(() => {
    detachMonitor();
    reconnectingIceRef.current = false;
    videoSuspendedByPolicyRef.current = false;
    capturedVideoTrackRef.current = null;
    metricsSamplesRef.current = 0;
    poorNetworkStreakRef.current = 0;
    goodNetworkStreakRef.current = 0;
    lastQualityInputsRef.current = null;
    iceConnectionStateRef.current = null;
    setConnectionQuality(null);
    setVideoSuspendedForNetwork(false);
    try {
      pcRef.current?.getSenders().forEach((s) => s.track?.stop());
      pcRef.current?.close();
    } catch {
      /* ignore */
    }
    pcRef.current = null;
    remoteStreamRef.current = null;
    setRemoteStream(null);

    const sock = socketRef.current;
    if (sock?.connected) {
      sock.emit('leave', { consultationId });
    }
    if (ownSocketRef.current && sock) {
      sock.disconnect();
    }
    socketRef.current = null;
    ownSocketRef.current = false;

    setLocalStream((prev) => {
      prev?.getTracks().forEach((t) => t.stop());
      return null;
    });
    setConnectionState(null);
    setIceConnectionState(null);
    setVideoTier(0);
    videoTierRef.current = 0;
  }, [consultationId, detachMonitor]);

  const startRecording = useCallback(
    async (userConsent: boolean) => {
      await requestRecordingStart({
        backendOrigin,
        accessToken,
        consultationId,
        userConsent,
      });
    },
    [accessToken, backendOrigin, consultationId],
  );

  const stopRecording = useCallback(
    async (userConsent: boolean) => {
      await requestRecordingStop({
        backendOrigin,
        accessToken,
        consultationId,
        userConsent,
      });
    },
    [accessToken, backendOrigin, consultationId],
  );

  const startCall = useCallback(async () => {
    endCall();
    remoteIdRef.current = null;
    onRemoteUserId?.(null);

    let socket = externalSocket ?? null;
    if (!socket) {
      const origin = backendOrigin.replace(/\/$/, '');
      socket = io(`${origin}/webrtc`, {
        path: socketPath,
        transports: ['websocket', 'polling'],
        auth: { token: accessToken },
        autoConnect: true,
      });
      ownSocketRef.current = true;
    } else {
      ownSocketRef.current = false;
    }

    await new Promise<void>((resolve, reject) => {
      if (socket.connected) {
        resolve();
        return;
      }
      socket.once('connect', () => resolve());
      socket.once('connect_error', (err) => reject(err));
    });

    socketRef.current = socket;

    const iceServers = await fetchWebrtcIceServers({
      backendOrigin,
      consultationId,
      accessToken,
    });

    const pc = new RTCPeerConnection(createProRtcConfiguration(iceServers));
    pcRef.current = pc;
    wirePeerConnection(pc);

    const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
    setLocalStream(stream);

    capturedVideoTrackRef.current = stream.getVideoTracks()[0] ?? null;
    videoSuspendedByPolicyRef.current = false;
    setVideoSuspendedForNetwork(false);
    metricsSamplesRef.current = 0;
    poorNetworkStreakRef.current = 0;
    goodNetworkStreakRef.current = 0;
    setConnectionQuality('good');

    for (const track of stream.getAudioTracks()) {
      pc.addTrack(track, stream);
    }
    for (const track of stream.getVideoTracks()) {
      pc.addTrack(track, stream);
    }

    await prioritizeAudioOverVideo(pc, videoTierRef.current);

    attachSignalingHandlers(socket, pc);

    socket.emit('join-consultation', { consultationId }, (ack: unknown) => {
      if (ack && typeof ack === 'object' && 'ok' in ack && (ack as { ok?: boolean }).ok !== true) {
        onError?.('join-consultation rejected');
      }
    });

    stopStatsRef.current = createAdaptiveVideoMonitor(
      pc,
      () => pc.getSenders().find((s) => s.track?.kind === 'video'),
      {
        intervalMs: 2500,
        onTierChange: (tier) => {
          setVideoTier(tier);
          onVideoTierChange?.(tier);
        },
        onStatsSample: async ({ snap, lossRatio }) => {
          const qualityInputs = {
            reconnecting: reconnectingIceRef.current,
            iceConnectionState: iceConnectionStateRef.current,
            lossRatio,
            rttMs: snap.roundTripTime,
            outboundBitrateBps: snap.outboundBitrateBps,
            videoSuspendedForNetwork: videoSuspendedByPolicyRef.current,
          };
          lastQualityInputsRef.current = qualityInputs;
          setConnectionQuality(deriveConnectionQuality(qualityInputs));

          const lowBitrate =
            snap.outboundBitrateBps !== undefined &&
            snap.outboundBitrateBps > 0 &&
            snap.outboundBitrateBps < 100_000;

          if (lossRatio > 0.12 || lowBitrate) {
            poorNetworkStreakRef.current += 1;
            goodNetworkStreakRef.current = 0;
          } else {
            poorNetworkStreakRef.current = 0;
          }

          if (
            lossRatio < 0.02 &&
            (snap.roundTripTime === undefined || snap.roundTripTime < 280)
          ) {
            goodNetworkStreakRef.current += 1;
          } else {
            goodNetworkStreakRef.current = 0;
          }

          const videoSender = pc
            .getSenders()
            .find((s) => s.track?.kind === 'video');

          if (
            poorNetworkStreakRef.current >= 2 &&
            !videoSuspendedByPolicyRef.current &&
            capturedVideoTrackRef.current &&
            videoSender
          ) {
            videoSuspendedByPolicyRef.current = true;
            setVideoSuspendedForNetwork(true);
            try {
              await videoSender.replaceTrack(null);
            } catch {
              /* ignore */
            }
          }

          if (
            goodNetworkStreakRef.current >= 4 &&
            videoSuspendedByPolicyRef.current &&
            capturedVideoTrackRef.current &&
            videoSender
          ) {
            videoSuspendedByPolicyRef.current = false;
            setVideoSuspendedForNetwork(false);
            goodNetworkStreakRef.current = 0;
            try {
              await videoSender.replaceTrack(capturedVideoTrackRef.current);
              await prioritizeAudioOverVideo(pc, videoTierRef.current);
            } catch {
              /* ignore */
            }
          }

          if (sendCallMetricsToBackend) {
            metricsSamplesRef.current += 1;
            if (metricsSamplesRef.current >= 3) {
              metricsSamplesRef.current = 0;
              void sendCallMetrics({
                backendOrigin,
                accessToken,
                consultationId,
                rtt: snap.roundTripTime,
                packetsLost: snap.packetsLost,
                bitrate: snap.outboundBitrateBps,
                jitter: snap.jitter,
                packetLossRatio: lossRatio,
              }).catch(() => {
                /* no UX spam */
              });
            }
          }
        },
      },
    );

    if (isInitiator && remoteIdRef.current) {
      /* peer already in room */
      makingOfferRef.current = true;
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('offer', {
          consultationId,
          sdp: pc.localDescription,
        });
      } catch (e) {
        onError?.((e as Error).message);
      } finally {
        makingOfferRef.current = false;
      }
    }
  }, [
    accessToken,
    attachSignalingHandlers,
    backendOrigin,
    consultationId,
    endCall,
    externalSocket,
    isInitiator,
    mediaConstraints,
    onError,
    onRemoteUserId,
    onVideoTierChange,
    sendCallMetricsToBackend,
    socketPath,
    wirePeerConnection,
  ]);

  useEffect(() => {
    const onVisibility = () => {
      if (
        document.visibilityState === 'visible' &&
        (pcRef.current?.iceConnectionState === 'disconnected' ||
          pcRef.current?.connectionState === 'disconnected')
      ) {
        void runIceRestart();
      }
    };
    const onOnline = () => {
      const pc = pcRef.current;
      if (
        pc &&
        (pc.iceConnectionState === 'disconnected' ||
          pc.iceConnectionState === 'failed' ||
          pc.connectionState === 'disconnected' ||
          pc.connectionState === 'failed')
      ) {
        void runIceRestart();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
    };
  }, [runIceRestart]);

  useEffect(() => () => endCall(), [endCall]);

  return {
    localStream,
    remoteStream,
    connectionState,
    iceConnectionState,
    videoTier,
    connectionQuality,
    videoSuspendedForNetwork,
    startCall,
    endCall,
    startRecording,
    stopRecording,
  };
}
