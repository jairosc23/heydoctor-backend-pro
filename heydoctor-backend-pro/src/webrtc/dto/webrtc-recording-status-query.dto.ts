import { IsUUID } from 'class-validator';

export class WebrtcRecordingStatusQueryDto {
  @IsUUID('4')
  consultationId!: string;
}
