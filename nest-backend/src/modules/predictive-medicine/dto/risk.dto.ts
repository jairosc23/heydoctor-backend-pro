import { IsOptional, IsArray, IsObject, IsString } from 'class-validator';

export class PredictiveRiskDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  symptoms?: string[];

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;
}
