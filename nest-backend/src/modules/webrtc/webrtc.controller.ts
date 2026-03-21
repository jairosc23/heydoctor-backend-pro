import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { WebrtcService } from './webrtc.service';

/**
 * ICE servers para WebRTC (TURN/STUN).
 * No modifica la infraestructura TURN existente.
 */
@Controller('webrtc')
export class WebrtcController {
  constructor(private readonly webrtcService: WebrtcService) {}

  @Public()
  @Get('ice-servers')
  getIceServers() {
    return this.webrtcService.getIceServers();
  }
}
