import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Client-side WebRTC stats snapshots (no SDP, no media payload, no PHI).
 * Used for quality monitoring and debugging.
 */
@Entity({ name: 'webrtc_call_metrics' })
@Index(['consultationId', 'recordedAt'])
export class WebrtcCallMetric {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'consultation_id', type: 'uuid' })
  consultationId!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @CreateDateColumn({ name: 'recorded_at', type: 'timestamptz' })
  recordedAt!: Date;

  /** Round-trip time in milliseconds (from RTCP / candidate-pair where available). */
  @Column({ name: 'rtt_ms', type: 'double precision', nullable: true })
  rttMs!: number | null;

  /** Cumulative packets lost reported for outbound video RTP (snapshot). */
  @Column({ name: 'packets_lost', type: 'int', nullable: true })
  packetsLost!: number | null;

  /** Estimated outbound video bitrate in bits per second. */
  @Column({
    name: 'outbound_bitrate_bps',
    type: 'double precision',
    nullable: true,
  })
  outboundBitrateBps!: number | null;

  /** Jitter in seconds as reported by getStats (remote-inbound / outbound). */
  @Column({
    name: 'jitter_seconds',
    type: 'double precision',
    nullable: true,
  })
  jitterSeconds!: number | null;

  /** Optional client-reported loss ratio in this interval (0–1). */
  @Column({
    name: 'packet_loss_ratio',
    type: 'double precision',
    nullable: true,
  })
  packetLossRatio!: number | null;

  /** Client session id for correlating samples (no PHI). */
  @Column({ name: 'call_id', type: 'uuid', nullable: true })
  callId!: string | null;

  /** e.g. relay | srflx | host — for transport mix analytics. */
  @Column({
    name: 'selected_candidate_type',
    type: 'varchar',
    length: 16,
    nullable: true,
  })
  selectedCandidateType!: string | null;

  /** Inferred or client-reported region label (scl | gru | bog). */
  @Column({ name: 'turn_region', type: 'varchar', length: 32, nullable: true })
  turnRegion!: string | null;

  /** ICE restarts observed in the client sampling window. */
  @Column({ name: 'ice_restart_events', type: 'int', nullable: true })
  iceRestartEvents!: number | null;
}
