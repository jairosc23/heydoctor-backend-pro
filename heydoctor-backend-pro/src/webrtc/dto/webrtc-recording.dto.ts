import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class WebrtcRecordingStartDto {
  @IsUUID('4')
  consultationId!: string;

  /** Explicit consent flag at time of request (audit only; not legal advice). */
  @IsBoolean()
  userConsent!: boolean;

  /** Policy: whether organizational rules require explicit consent (defaults true when omitted). */
  @IsOptional()
  @IsBoolean()
  consentRequired?: boolean;
}

export class WebrtcRecordingStopDto {
  @IsUUID('4')
  consultationId!: string;

  @IsBoolean()
  userConsent!: boolean;

  @IsOptional()
  @IsBoolean()
  consentRequired?: boolean;
}
