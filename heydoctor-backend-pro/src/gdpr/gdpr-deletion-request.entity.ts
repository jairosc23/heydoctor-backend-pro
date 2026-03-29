import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum DeletionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * Tracks GDPR Art. 17 data deletion requests.
 * Implements progressive anonymization rather than hard DELETE
 * to preserve audit trail integrity and clinical retention obligations.
 */
@Entity('gdpr_deletion_requests')
@Index(['userId'])
@Index(['status'])
export class GdprDeletionRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'enum', enum: DeletionStatus, default: DeletionStatus.PENDING })
  status: DeletionStatus;

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt: Date | null;

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt: Date | null;

  /** Fields that were anonymized, for auditability. */
  @Column({ name: 'anonymized_fields', type: 'jsonb', nullable: true })
  anonymizedFields: Record<string, string[]> | null;

  @Column({ name: 'error_detail', type: 'text', nullable: true })
  errorDetail: string | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 64, nullable: true })
  ipAddress: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
