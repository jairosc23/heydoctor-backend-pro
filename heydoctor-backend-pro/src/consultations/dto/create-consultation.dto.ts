import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateConsultationDto {
  @IsUUID('4')
  patientId: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(20000)
  chiefComplaint: string;

  /** Región lógica (p. ej. `eu-west`, `cl-santiago`). */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  region?: string;
}
