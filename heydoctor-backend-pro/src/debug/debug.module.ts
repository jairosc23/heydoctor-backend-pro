import { Module } from '@nestjs/common';
import { DatabaseDiagnosticService } from './database-diagnostic.service';
import { DebugController } from './debug.controller';

@Module({
  controllers: [DebugController],
  providers: [DatabaseDiagnosticService],
})
export class DebugModule {}
