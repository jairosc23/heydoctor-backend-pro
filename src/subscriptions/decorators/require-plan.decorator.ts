import { SetMetadata } from '@nestjs/common';
import { SubscriptionPlan } from '../subscription.entity';

export const REQUIRE_PLAN_KEY = 'require_plan';

/** Restrict endpoint/gateway access to a minimum subscription plan. */
export const RequirePlan = (plan: SubscriptionPlan) =>
  SetMetadata(REQUIRE_PLAN_KEY, plan);
