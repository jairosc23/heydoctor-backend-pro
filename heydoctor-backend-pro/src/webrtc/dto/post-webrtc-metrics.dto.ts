import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class PostWebrtcMetricsDto {
  @IsUUID('4')
  consultationId!: string;

  /** RTT in ms */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(600_000)
  rtt?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  packetsLost?: number;

  /** Outbound video bitrate (bps) */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  bitrate?: number;

  /** Jitter in seconds (WebRTC stats convention) */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(60)
  jitter?: number;

  /** Observed packet loss ratio in the sampling window (0–1) */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  packetLossRatio?: number;
}
