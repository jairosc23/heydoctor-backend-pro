import { Global, Module } from '@nestjs/common';
import { DatabaseRoutingService } from './database-routing.service';

@Global()
@Module({
  providers: [DatabaseRoutingService],
  exports: [DatabaseRoutingService],
})
export class DatabaseRoutingModule {}
