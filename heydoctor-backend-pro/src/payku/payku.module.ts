import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { PaykuPayment } from './payku-payment.entity';
import { PaykuController } from './payku.controller';
import { PaykuService } from './payku.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PaykuPayment]),
    AuditModule,
    SubscriptionsModule,
  ],
  controllers: [PaykuController],
  providers: [PaykuService],
  exports: [PaykuService],
})
export class PaykuModule {}
