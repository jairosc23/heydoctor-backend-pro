import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { WebrtcController } from './webrtc.controller';
import { WebrtcService } from './webrtc.service';

@Module({
  imports: [CommonModule],
  controllers: [WebrtcController],
  providers: [WebrtcService],
  exports: [WebrtcService],
})
export class WebrtcModule {}
