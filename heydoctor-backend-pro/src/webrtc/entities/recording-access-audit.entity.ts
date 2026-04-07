import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Audit trail for who touched recording metadata (future: download, playback). */
@Entity({ name: 'recording_access_audits' })
@Index(['recordingSessionId', 'createdAt'])
export class RecordingAccessAudit {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'recording_session_id', type: 'uuid' })
  recordingSessionId!: string;

  @Column({ name: 'actor_user_id', type: 'uuid' })
  actorUserId!: string;

  @Column({ name: 'action', type: 'varchar', length: 64 })
  action!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
