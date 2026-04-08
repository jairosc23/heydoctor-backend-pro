import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  MAX_ANALYTICS_WINDOW_DAYS,
  MIN_ANALYTICS_WINDOW_DAYS,
} from '../../common/analytics/analytics-window.constants';

export class PlatformGlobalMetricsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_ANALYTICS_WINDOW_DAYS)
  @Max(MAX_ANALYTICS_WINDOW_DAYS)
  windowDays?: number;
}
