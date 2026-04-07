import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type RecordingSessionStatus =
  | 'pending'
  | 'active'
  | 'finalized'
  | 'failed';

/**
 * Metadata-only recording session (no media blob stored yet).
 * See RECORDING_ARCHITECTURE.md for encryption and S3-compatible storage.
 */
@Entity({ name: 'recording_sessions' })
@Index(['consultationId', 'status'])
export class RecordingSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'consultation_id', type: 'uuid' })
  consultationId!: string;

  @Column({ name: 'started_by_user_id', type: 'uuid' })
  startedByUserId!: string;

  @Column({ name: 'status', type: 'varchar', length: 24 })
  status!: RecordingSessionStatus;

  @Column({ name: 'consent_asserted', type: 'boolean' })
  consentAsserted!: boolean;

  @Column({ name: 'consent_required', type: 'boolean', default: true })
  consentRequired!: boolean;

  /** Future: KMS/key reference for envelope encryption; never raw keys in logs. */
  @Column({ name: 'encryption_key_ref', type: 'text', nullable: true })
  encryptionKeyRef!: string | null;

  @Column({ name: 'storage_provider', type: 'varchar', length: 32 })
  storageProvider!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
