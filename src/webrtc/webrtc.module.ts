import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ConsultationsModule } from '../consultations/consultations.module';
import { UsersModule } from '../users/users.module';
import { WebrtcGateway } from './webrtc.gateway';

/**
 * WebRTC signaling over Socket.IO (no media). For horizontal scale, attach a
 * Redis adapter to the Socket.IO server (see OUTPUT / Nest + socket.io-redis).
 */
@Module({
  imports: [AuthModule, UsersModule, ConsultationsModule],
  providers: [WebrtcGateway],
})
export class WebrtcModule {}
