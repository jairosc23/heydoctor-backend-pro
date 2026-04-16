import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Nombres permitidos en ingest (alineados con el SDK del frontend). */
export const ANALYTICS_EVENT_NAMES = [
  'page_view',
  'consultation_started',
  'consultation_paid',
  'consultation_completed',
  'payment_initiated',
  'payment_failed',
  'payment_abandoned',
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

@Entity('analytics_events')
@Index(['eventName', 'createdAt'])
@Index(['sessionId', 'createdAt'])
export class AnalyticsEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_name', type: 'varchar', length: 64 })
  eventName: string;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  path: string | null;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ name: 'session_id', type: 'varchar', length: 64 })
  sessionId: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 512, nullable: true })
  userAgent: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
