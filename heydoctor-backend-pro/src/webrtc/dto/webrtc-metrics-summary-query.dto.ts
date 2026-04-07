import { IsUUID } from 'class-validator';

export class WebrtcMetricsSummaryQueryDto {
  @IsUUID('4')
  consultationId!: string;
}
