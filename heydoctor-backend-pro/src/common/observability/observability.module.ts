import { Global, Module } from '@nestjs/common';
import { LoggerModule } from '../logger/logger.module';
import { EnterpriseObservabilityService } from './enterprise-observability.service';
import { HttpLoadTrackerService } from './http-load-tracker.service';
import { PrometheusController } from './prometheus.controller';
import { PrometheusService } from './prometheus.service';

@Global()
@Module({
  imports: [LoggerModule],
  controllers: [PrometheusController],
  providers: [
    EnterpriseObservabilityService,
    HttpLoadTrackerService,
    PrometheusService,
  ],
  exports: [
    EnterpriseObservabilityService,
    HttpLoadTrackerService,
    PrometheusService,
  ],
})
export class ObservabilityModule {}
