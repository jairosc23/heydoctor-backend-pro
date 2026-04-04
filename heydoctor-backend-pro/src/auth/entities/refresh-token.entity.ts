import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('refresh_tokens')
@Index('IDX_refresh_tokens_user_id_clinic_id', ['userId', 'clinicId'])
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'token_hash' })
  tokenHash: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** Clínica al crear la sesión (auditoría / revoke por tenant). */
  @Index()
  @Column({ name: 'clinic_id', type: 'uuid', nullable: true })
  clinicId: string | null;

  @Index('IDX_refresh_tokens_expires_at')
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Index('IDX_refresh_tokens_revoked_at')
  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 64, nullable: true })
  ipAddress: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string | null;

  /** Etiqueta estable para UI (p. ej. "Chrome on Mac"). */
  @Column({
    name: 'user_agent_normalized',
    type: 'varchar',
    length: 256,
    nullable: true,
  })
  userAgentNormalized: string | null;

  /** SHA-256 del UA normalizado (correlación sin tracking invasivo). */
  @Column({ name: 'device_hash', type: 'varchar', length: 64, nullable: true })
  deviceHash: string | null;

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
