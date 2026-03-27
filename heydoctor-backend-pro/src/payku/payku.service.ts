import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { AuditService } from '../audit/audit.service';
import {
  SubscriptionChangeSource,
  SubscriptionPlan,
} from '../subscriptions/subscription.entity';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { UserRole } from '../users/user-role.enum';
import {
  PaykuPayment,
  PaykuPaymentStatus,
  isFinalStatus,
  isTransitionAllowed,
} from './payku-payment.entity';
import {
  assertPaykuWebhookAuthenticated,
  type PaykuWebhookAuthConfig,
} from './payku-webhook-auth';

const SYSTEM_USER: AuthenticatedUser = {
  sub: 'system-payku-webhook',
  email: 'system@heydoctor.internal',
  role: UserRole.ADMIN,
};

type WebhookResult = {
  action: string;
  paymentId?: string;
  duplicate?: boolean;
  error?: string;
};

@Injectable()
export class PaykuService {
  private readonly logger = new Logger(PaykuService.name);
  private readonly authConfig: PaykuWebhookAuthConfig;
  private readonly pendingExpireMinutes: number;

  constructor(
    @InjectRepository(PaykuPayment)
    private readonly paymentsRepository: Repository<PaykuPayment>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly auditService: AuditService,
  ) {
    this.authConfig = {
      webhookSecret: this.config.get<string>('PAYKU_WEBHOOK_SECRET'),
      webhookBearer: this.config.get<string>('PAYKU_WEBHOOK_BEARER'),
      allowUnsafeLocal:
        this.config.get<string>('PAYKU_WEBHOOK_ALLOW_UNSAFE_LOCAL') === 'true',
      nodeEnv: this.config.get<string>('NODE_ENV') ?? 'development',
    };
    this.pendingExpireMinutes = Number(
      this.config.get<string>('PAYMENT_PENDING_EXPIRE_MINUTES') ?? '1440',
    );
  }

  /**
   * Full webhook handler. Always returns a result (never throws to the caller).
   * The controller is responsible for returning 200 { ok: true } regardless.
   */
  async handleWebhook(
    headers: Record<string, string | string[] | undefined>,
    body: Record<string, unknown>,
  ): Promise<WebhookResult> {
    try {
      assertPaykuWebhookAuthenticated(headers, body, this.authConfig);
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.warn(`Webhook auth failed: ${msg}`);
      void this.auditService.logError({
        action: 'PAYKU_WEBHOOK_AUTH_FAILED',
        resource: 'payment',
        resourceId: null,
        userId: null,
        clinicId: null,
        httpStatus: 401,
        errorMessage: msg,
        metadata: { ip: body._ip as string | undefined },
      });
      return { action: 'auth_failed', error: msg };
    }

    const paymentId = String(
      body.payment_id ?? body.paymentId ?? body.id ?? '',
    );
    if (!paymentId) {
      this.logger.warn('Webhook missing payment_id');
      return { action: 'missing_payment_id' };
    }

    const incomingStatus = this.resolveStatus(body);
    if (!incomingStatus) {
      this.logger.warn(`Webhook unknown status for payment ${paymentId}`);
      return { action: 'unknown_status', paymentId };
    }

    const incomingAmount = this.extractAmount(body);

    return this.processWebhookInTransaction(
      paymentId,
      incomingStatus,
      incomingAmount,
      body,
    );
  }

  private async processWebhookInTransaction(
    paymentId: string,
    incomingStatus: PaykuPaymentStatus,
    incomingAmount: number | null,
    rawBody: Record<string, unknown>,
  ): Promise<WebhookResult> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(PaykuPayment);

      const payment = await repo.findOne({
        where: { id: paymentId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!payment) {
        this.logger.warn(`Payment ${paymentId} not found`);
        void this.auditService.logError({
          action: 'PAYKU_WEBHOOK_PAYMENT_NOT_FOUND',
          resource: 'payment',
          resourceId: paymentId,
          userId: null,
          clinicId: null,
          httpStatus: 200,
          errorMessage: 'Payment not found',
        });
        return { action: 'payment_not_found', paymentId };
      }

      const statusBefore = payment.status;

      if (isFinalStatus(payment.status)) {
        const isDuplicate = payment.status === incomingStatus;
        void this.auditService.logSuccess({
          action: 'PAYMENT_STATUS_UPDATED',
          resource: 'payment',
          resourceId: paymentId,
          userId: payment.userId,
          clinicId: null,
          httpStatus: 200,
          metadata: {
            statusBefore,
            statusAfter: payment.status,
            duplicate: true,
            reason: isDuplicate
              ? 'duplicate_webhook'
              : 'final_status_unchanged',
            transactionId: payment.transactionId,
          },
        });
        return { action: 'already_final', paymentId, duplicate: true };
      }

      this.expireIfStale(payment);

      if (isFinalStatus(payment.status) && payment.status !== incomingStatus) {
        void this.auditService.logSuccess({
          action: 'PAYMENT_STATUS_UPDATED',
          resource: 'payment',
          resourceId: paymentId,
          userId: payment.userId,
          clinicId: null,
          httpStatus: 200,
          metadata: {
            statusBefore,
            statusAfter: payment.status,
            reason: 'expired_before_webhook',
            transactionId: payment.transactionId,
          },
        });
        return { action: 'expired_before_webhook', paymentId };
      }

      if (!isTransitionAllowed(payment.status, incomingStatus)) {
        this.logger.warn(
          `Invalid transition ${payment.status} → ${incomingStatus} for ${paymentId}`,
        );
        void this.auditService.logError({
          action: 'PAYMENT_STATUS_UPDATED',
          resource: 'payment',
          resourceId: paymentId,
          userId: payment.userId,
          clinicId: null,
          httpStatus: 200,
          errorMessage: `Invalid transition: ${payment.status} → ${incomingStatus}`,
        });
        return { action: 'invalid_transition', paymentId };
      }

      if (incomingStatus === PaykuPaymentStatus.PAID) {
        if (incomingAmount == null) {
          this.logger.warn(`Missing amount in paid webhook for ${paymentId}`);
          void this.auditService.logError({
            action: 'PAYMENT_STATUS_UPDATED',
            resource: 'payment',
            resourceId: paymentId,
            userId: payment.userId,
            clinicId: null,
            httpStatus: 200,
            errorMessage: 'Missing amount in webhook payload',
          });
          return { action: 'missing_amount', paymentId };
        }

        if (incomingAmount !== payment.amount) {
          this.logger.warn(
            `Amount mismatch for ${paymentId}: expected ${payment.amount}, got ${incomingAmount}`,
          );
          void this.auditService.logError({
            action: 'PAYMENT_STATUS_UPDATED',
            resource: 'payment',
            resourceId: paymentId,
            userId: payment.userId,
            clinicId: null,
            httpStatus: 200,
            errorMessage: `Amount mismatch: expected ${payment.amount}, got ${incomingAmount}`,
            metadata: {
              expectedAmount: payment.amount,
              receivedAmount: incomingAmount,
            },
          });
          return { action: 'amount_mismatch', paymentId };
        }
      }

      payment.status = incomingStatus;
      payment.rawResponse = rawBody;

      if (incomingStatus === PaykuPaymentStatus.PAID) {
        payment.transactionId = String(
          rawBody.transaction_id ?? rawBody.transactionId ?? null,
        );
        payment.paidAt = new Date();
      }

      await repo.save(payment);

      void this.auditService.logSuccess({
        action: 'PAYMENT_STATUS_UPDATED',
        resource: 'payment',
        resourceId: paymentId,
        userId: payment.userId,
        clinicId: null,
        httpStatus: 200,
        metadata: {
          amount: payment.amount,
          statusBefore,
          statusAfter: incomingStatus,
          transactionId: payment.transactionId,
          duplicate: false,
          reason: 'webhook_processed',
        },
      });

      if (incomingStatus === PaykuPaymentStatus.PAID) {
        try {
          await this.subscriptionsService.updatePlan(
            payment.userId,
            SubscriptionPlan.PRO,
            SYSTEM_USER,
            SubscriptionChangeSource.WEBHOOK,
            'payku payment',
          );
        } catch (err) {
          this.logger.error(
            `Failed to upgrade user ${payment.userId} after payment ${paymentId}`,
            err,
          );
        }
      }

      return { action: 'processed', paymentId };
    });
  }

  private expireIfStale(payment: PaykuPayment): void {
    if (payment.status !== PaykuPaymentStatus.PENDING) return;

    const ageMs = Date.now() - payment.createdAt.getTime();
    const limitMs = this.pendingExpireMinutes * 60_000;

    if (ageMs > limitMs) {
      payment.status = PaykuPaymentStatus.EXPIRED;
      this.logger.log(`Payment ${payment.id} auto-expired (age: ${Math.round(ageMs / 60_000)}min)`);
    }
  }

  private resolveStatus(
    body: Record<string, unknown>,
  ): PaykuPaymentStatus | null {
    const raw = String(
      body.status ?? body.payment_status ?? body.estado ?? '',
    ).toLowerCase();

    switch (raw) {
      case 'paid':
      case 'success':
      case 'approved':
      case 'pagado':
        return PaykuPaymentStatus.PAID;
      case 'failed':
      case 'rejected':
      case 'rechazado':
        return PaykuPaymentStatus.FAILED;
      case 'cancelled':
      case 'canceled':
      case 'cancelado':
        return PaykuPaymentStatus.CANCELLED;
      case 'expired':
      case 'expirado':
        return PaykuPaymentStatus.EXPIRED;
      case 'pending':
      case 'pendiente':
        return PaykuPaymentStatus.PENDING;
      default:
        return null;
    }
  }

  private extractAmount(body: Record<string, unknown>): number | null {
    const raw = body.amount ?? body.monto ?? body.total;
    if (raw == null) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? Math.round(parsed) : null;
  }
}
