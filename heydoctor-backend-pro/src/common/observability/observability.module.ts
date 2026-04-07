import { Global, Module } from '@nestjs/common';
import { LoggerModule } from '../logger/logger.module';
import { EnterpriseObservabilityService } from './enterprise-observability.service';

@Global()
@Module({
  imports: [LoggerModule],
  providers: [EnterpriseObservabilityService],
  exports: [EnterpriseObservabilityService],
})
export class ObservabilityModule {}
