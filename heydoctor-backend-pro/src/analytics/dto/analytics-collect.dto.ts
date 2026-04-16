import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ANALYTICS_EVENT_NAMES } from '../analytics-event.entity';

const ALLOWED = new Set<string>(ANALYTICS_EVENT_NAMES);

export class AnalyticsEventItemDto {
  @IsString()
  @MaxLength(64)
  event!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  path?: string;

  @IsOptional()
  @IsUUID()
  consultationId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class AnalyticsCollectDto {
  @IsString()
  @MaxLength(64)
  sessionId!: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsArray()
  @ArrayMaxSize(32)
  @ValidateNested({ each: true })
  @Type(() => AnalyticsEventItemDto)
  events!: AnalyticsEventItemDto[];
}

export function normalizeAnalyticsEventName(raw: string): string | null {
  const t = raw?.trim();
  if (!t || !ALLOWED.has(t)) {
    return null;
  }
  return t;
}
