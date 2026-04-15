import { Global, Module } from '@nestjs/common';
import { ResilienceModule } from '../resilience/resilience.module';
import { SuspiciousTrafficService } from '../security/suspicious-traffic.service';
import { LoggerModule } from '../logger/logger.module';
import { EnterpriseObservabilityService } from './enterprise-observability.service';
import { HttpLoadTrackerService } from './http-load-tracker.service';
import { PrometheusController } from './prometheus.controller';
import { PrometheusService } from './prometheus.service';

@Global()
@Module({
  imports: [LoggerModule, ResilienceModule],
  controllers: [PrometheusController],
  providers: [
    EnterpriseObservabilityService,
    HttpLoadTrackerService,
    PrometheusService,
    SuspiciousTrafficService,
  ],
  exports: [
    EnterpriseObservabilityService,
    HttpLoadTrackerService,
    PrometheusService,
    SuspiciousTrafficService,
  ],
})
export class ObservabilityModule {}
