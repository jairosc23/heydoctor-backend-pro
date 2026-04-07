import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Lightweight input for assistive suggestions only (no automatic decisions).
 */
export class ConsultationAssistDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  chiefComplaint?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  symptoms?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  notes?: string;
}
