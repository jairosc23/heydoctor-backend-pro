import { Global, Module } from '@nestjs/common';
import { RegionRoutingService } from './region-routing.service';

@Global()
@Module({
  providers: [RegionRoutingService],
  exports: [RegionRoutingService],
})
export class RegionModule {}
