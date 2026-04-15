import { Global, Module } from '@nestjs/common';
import { DatabaseRoutingService } from './database-routing.service';
import { ReadReplicaCircuitService } from './read-replica-circuit.service';

@Global()
@Module({
  providers: [DatabaseRoutingService, ReadReplicaCircuitService],
  exports: [DatabaseRoutingService, ReadReplicaCircuitService],
})
export class DatabaseRoutingModule {}
