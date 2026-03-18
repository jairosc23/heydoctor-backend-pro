import { IsOptional, IsString, IsArray, IsObject } from 'class-validator';

export class CdssEvaluateDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  symptoms?: string[];

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;
}
