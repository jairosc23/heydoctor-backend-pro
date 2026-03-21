import { Module } from '@nestjs/common';
import { WebrtcController } from './webrtc.controller';
import { WebrtcService } from './webrtc.service';

@Module({
  controllers: [WebrtcController],
  providers: [WebrtcService],
  exports: [WebrtcService],
})
export class WebrtcModule {}
