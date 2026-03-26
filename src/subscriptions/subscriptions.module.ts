import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeatureGuard } from './guards/feature.guard';
import { Subscription } from './subscription.entity';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [TypeOrmModule.forFeature([Subscription])],
  providers: [SubscriptionsService, FeatureGuard],
  exports: [SubscriptionsService, FeatureGuard],
})
export class SubscriptionsModule {}
