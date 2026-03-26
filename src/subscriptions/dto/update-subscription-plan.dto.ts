import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  SubscriptionChangeReasonCode,
  SubscriptionPlan,
} from '../subscription.entity';

export class UpdateSubscriptionPlanDto {
  @IsEnum(SubscriptionPlan)
  plan: SubscriptionPlan;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;

  @IsOptional()
  @IsEnum(SubscriptionChangeReasonCode)
  reasonCode?: SubscriptionChangeReasonCode;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reasonText?: string;
}
