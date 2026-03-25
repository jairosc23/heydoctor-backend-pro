import { IsOptional, IsString, MaxLength } from 'class-validator';

export class GenerateAiDto {
  @IsString()
  reason: string;

  @IsString()
  notes: string;

  @IsString()
  diagnosis: string;

  @IsString()
  treatment: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  patientAge?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  patientSex?: string;

  /** Last portion of documentation for model focus (e.g. last 300 chars from client). */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  priorNotesExcerpt?: string;
}
