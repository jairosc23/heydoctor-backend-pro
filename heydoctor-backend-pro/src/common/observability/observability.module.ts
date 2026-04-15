import { Global, Module } from '@nestjs/common';
import { LoggerModule } from '../logger/logger.module';
import { EnterpriseObservabilityService } from './enterprise-observability.service';
import { PrometheusController } from './prometheus.controller';
import { PrometheusService } from './prometheus.service';

@Global()
@Module({
  imports: [LoggerModule],
  controllers: [PrometheusController],
  providers: [EnterpriseObservabilityService, PrometheusService],
  exports: [EnterpriseObservabilityService, PrometheusService],
})
export class ObservabilityModule {}
