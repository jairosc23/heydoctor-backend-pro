import { Global, Module } from '@nestjs/common';
import { MitigationHooksService } from './mitigation-hooks.service';

@Global()
@Module({
  providers: [MitigationHooksService],
  exports: [MitigationHooksService],
})
export class ResilienceModule {}
