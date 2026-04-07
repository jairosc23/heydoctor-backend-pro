import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
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

  /** Per-call correlation (client-generated UUID). */
  @IsOptional()
  @IsUUID('4')
  callId?: string;

  /** Selected candidate type for transport mix (client-reported). */
  @IsOptional()
  @IsString()
  @IsIn(['relay', 'srflx', 'host', 'prflx', 'unknown'])
  @MaxLength(16)
  selectedCandidateType?: string;

  /** Region hint: scl | gru | bog | legacy | unknown */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  turnRegion?: string;

  /** ICE restart events in the client sampling window. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  iceRestartEvents?: number;
}
