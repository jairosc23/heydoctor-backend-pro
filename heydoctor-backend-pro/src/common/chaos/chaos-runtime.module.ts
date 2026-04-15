import { Global, Module } from '@nestjs/common';
import { ChaosRuntimeService } from './chaos-runtime.service';

@Global()
@Module({
  providers: [ChaosRuntimeService],
  exports: [ChaosRuntimeService],
})
export class ChaosRuntimeModule {}
