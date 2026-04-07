import { Injectable, Logger } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { ConsultationsService } from '../consultations/consultations.service';
import type {
  WebrtcRecordingStartDto,
  WebrtcRecordingStopDto,
} from './dto/webrtc-recording.dto';

/**
 * Accept-only placeholder until a compliant recording pipeline exists.
 */
@Injectable()
export class WebrtcRecordingStubService {
  private readonly logger = new Logger(WebrtcRecordingStubService.name);

  constructor(private readonly consultationsService: ConsultationsService) {}

  async start(
    user: AuthenticatedUser,
    dto: WebrtcRecordingStartDto,
  ): Promise<{
    ok: true;
    accepted: true;
    mode: 'stub';
    consultationId: string;
  }> {
    await this.consultationsService.verifySignalingAccess(
      dto.consultationId,
      user,
    );
    this.logger.log(
      `recording/start (stub) consultationId=${dto.consultationId} userId=${user.sub} consent=${dto.userConsent}`,
    );
    return {
      ok: true,
      accepted: true,
      mode: 'stub',
      consultationId: dto.consultationId,
    };
  }

  async stop(
    user: AuthenticatedUser,
    dto: WebrtcRecordingStopDto,
  ): Promise<{
    ok: true;
    accepted: true;
    mode: 'stub';
    consultationId: string;
  }> {
    await this.consultationsService.verifySignalingAccess(
      dto.consultationId,
      user,
    );
    this.logger.log(
      `recording/stop (stub) consultationId=${dto.consultationId} userId=${user.sub} consent=${dto.userConsent}`,
    );
    return {
      ok: true,
      accepted: true,
      mode: 'stub',
      consultationId: dto.consultationId,
    };
  }
}
