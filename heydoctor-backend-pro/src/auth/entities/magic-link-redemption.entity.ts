import { CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/**
 * Canje de enlace mágico: una fila por `jti` (JWT dedicado) o por hash del token presentado.
 */
@Entity('auth_magic_link_redemptions')
export class MagicLinkRedemption {
  @PrimaryColumn({ name: 'redemption_key', type: 'varchar', length: 160 })
  redemptionKey!: string;

  @CreateDateColumn({ name: 'redeemed_at', type: 'timestamptz' })
  redeemedAt!: Date;
}
