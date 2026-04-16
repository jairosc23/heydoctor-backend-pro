import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { Consultation } from '../consultations/consultation.entity';
import { PaykuPayment } from '../payku/payku-payment.entity';
import { User } from '../users/user.entity';
import { AdminBusinessDashboardController } from './admin-business-dashboard.controller';
import { AdminBusinessDashboardService } from './admin-business-dashboard.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Consultation, PaykuPayment, User]),
    AnalyticsModule,
    AuthModule,
    AuditModule,
  ],
  controllers: [AdminBusinessDashboardController],
  providers: [AdminBusinessDashboardService],
})
export class AdminModule {}
