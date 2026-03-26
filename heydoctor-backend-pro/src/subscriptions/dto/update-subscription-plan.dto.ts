import { IsEnum } from 'class-validator';
import { SubscriptionPlan } from '../subscription.entity';

export class UpdateSubscriptionPlanDto {
  @IsEnum(SubscriptionPlan)
  plan: SubscriptionPlan;
}
