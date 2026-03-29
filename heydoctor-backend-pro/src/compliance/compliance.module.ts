import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditModule } from '../audit/audit.module';
import {
  ComplianceConfig,
  COMPLIANCE_CONFIG_TOKEN,
} from './compliance.config';
import { PhiAccessLogInterceptor } from './phi-access-log.interceptor';

@Global()
@Module({
  imports: [AuditModule],
  providers: [
    {
      provide: COMPLIANCE_CONFIG_TOKEN,
      useFactory: (config: ConfigService) => new ComplianceConfig(config),
      inject: [ConfigService],
    },
    PhiAccessLogInterceptor,
  ],
  exports: [COMPLIANCE_CONFIG_TOKEN, PhiAccessLogInterceptor],
})
export class ComplianceModule {}
