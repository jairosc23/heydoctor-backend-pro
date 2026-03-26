import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum SubscriptionPlan {
  FREE = 'free',
  PRO = 'pro',
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export enum SubscriptionChangeSource {
  ADMIN_PANEL = 'admin_panel',
  STRIPE = 'stripe',
  WEBHOOK = 'webhook',
  SYSTEM = 'system',
}

export enum SubscriptionChangeReasonCode {
  TRIAL = 'trial',
  SUPPORT = 'support',
  SALES = 'sales',
  REFUND = 'refund',
  MANUAL = 'manual',
  SYSTEM = 'system',
}

@Entity('subscriptions')
@Index(['userId'], { unique: true })
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({
    type: 'enum',
    enum: SubscriptionPlan,
    default: SubscriptionPlan.FREE,
  })
  plan: SubscriptionPlan;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.ACTIVE,
  })
  status: SubscriptionStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
