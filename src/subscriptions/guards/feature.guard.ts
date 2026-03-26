import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { REQUIRE_PLAN_KEY } from '../decorators/require-plan.decorator';
import { SubscriptionPlan } from '../subscription.entity';
import { SubscriptionsService } from '../subscriptions.service';

@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPlan = this.reflector.getAllAndOverride<SubscriptionPlan>(
      REQUIRE_PLAN_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredPlan) {
      return true;
    }

    const userId = this.getUserId(context);
    if (!userId) {
      throw new ForbiddenException('Authentication required');
    }

    const allowed = await this.subscriptionsService.hasRequiredPlan(
      userId,
      requiredPlan,
    );
    if (!allowed) {
      throw new ForbiddenException(`Feature requires ${requiredPlan} plan`);
    }
    return true;
  }

  private getUserId(context: ExecutionContext): string | null {
    if (context.getType() === 'http') {
      const req = context
        .switchToHttp()
        .getRequest<{ user?: AuthenticatedUser }>();
      return req.user?.sub ?? null;
    }
    if (context.getType() === 'ws') {
      const client = context
        .switchToWs()
        .getClient<{ data?: { user?: AuthenticatedUser } }>();
      return client?.data?.user?.sub ?? null;
    }
    return null;
  }
}
