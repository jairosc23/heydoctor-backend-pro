import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { AuditService } from '../audit/audit.service';
import { QueryFailedError, Repository } from 'typeorm';
import {
  SubscriptionChangeSource,
  SubscriptionChangeReasonCode,
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from './subscription.entity';

const PLAN_RANK: Record<SubscriptionPlan, number> = {
  [SubscriptionPlan.FREE]: 0,
  [SubscriptionPlan.PRO]: 1,
};

function sanitizeReason(reason?: string): string | undefined {
  if (typeof reason !== 'string') return undefined;
  const clean = reason.trim();
  return clean.length > 0 ? clean : undefined;
}

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionsRepository: Repository<Subscription>,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Backward-compatible default:
   * if user has no subscription row yet, create ACTIVE/FREE automatically.
   */
  async getOrCreateForUser(userId: string): Promise<Subscription> {
    const existing = await this.subscriptionsRepository.findOne({
      where: { userId },
    });
    if (existing) return existing;

    const created = this.subscriptionsRepository.create({
      userId,
      plan: SubscriptionPlan.FREE,
      status: SubscriptionStatus.ACTIVE,
    });
    try {
      return await this.subscriptionsRepository.save(created);
    } catch (e) {
      if (
        e instanceof QueryFailedError &&
        (e as { driverError?: { code?: string } }).driverError?.code === '23505'
      ) {
        const raced = await this.subscriptionsRepository.findOne({
          where: { userId },
        });
        if (raced) return raced;
      }
      throw e;
    }
  }

  async hasRequiredPlan(
    userId: string,
    requiredPlan: SubscriptionPlan,
  ): Promise<boolean> {
    const subscription = await this.getOrCreateForUser(userId);
    if (subscription.status !== SubscriptionStatus.ACTIVE) {
      return false;
    }
    return PLAN_RANK[subscription.plan] >= PLAN_RANK[requiredPlan];
  }

  async listAll(): Promise<Subscription[]> {
    return this.subscriptionsRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async updatePlan(
    userId: string,
    plan: SubscriptionPlan,
    authUser: AuthenticatedUser,
    source: SubscriptionChangeSource = SubscriptionChangeSource.ADMIN_PANEL,
    reason?: string,
    reasonCode?: SubscriptionChangeReasonCode,
    reasonText?: string,
  ): Promise<Subscription> {
    const existing = await this.getOrCreateForUser(userId);
    const previousPlan = existing.plan;

    if (previousPlan === plan) {
      return existing;
    }

    existing.plan = plan;
    const saved = await this.subscriptionsRepository.save(existing);
    const auditReason = sanitizeReason(reason);
    const auditReasonText = sanitizeReason(reasonText);

    // Audit is best-effort: failure should never break admin operation.
    void this.auditService.logSuccess({
      action: 'SUBSCRIPTION_PLAN_CHANGED',
      resource: 'subscription',
      resourceId: saved.id,
      userId,
      clinicId: null,
      httpStatus: 200,
      metadata: {
        from: previousPlan,
        to: plan,
        changedBy: authUser.sub,
        source,
        type: 'plan_change',
        ...(auditReason ? { reason: auditReason } : {}),
        ...(reasonCode ? { reasonCode } : {}),
        ...(auditReasonText ? { reasonText: auditReasonText } : {}),
      },
    });

    return saved;
  }
}
