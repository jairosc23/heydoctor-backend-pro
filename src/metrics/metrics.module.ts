import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { AuditLog } from '../audit/audit-log.entity';
import { DailyMetric } from './daily-metric.entity';
import { MetricsService } from './metrics.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AuditLog, DailyMetric]),
    AuditModule,
  ],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
