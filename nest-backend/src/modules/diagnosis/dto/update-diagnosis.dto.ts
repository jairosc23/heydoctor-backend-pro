import { IsString, IsOptional, IsUUID, IsDateString } from 'class-validator';

/** Matches Strapi api::diagnostic.diagnostic attributes. */
export class UpdateDiagnosisDto {
  @IsOptional()
  @IsUUID()
  consultationId?: string;

  @IsOptional()
  @IsUUID()
  clinicalRecordId?: string;

  @IsOptional()
  @IsUUID()
  doctorId?: string;

  @IsOptional()
  @IsUUID()
  patientId?: string;

  @IsOptional()
  @IsUUID()
  clinicId?: string;

  @IsOptional()
  @IsUUID()
  cie10CodeId?: string;

  @IsOptional()
  @IsDateString()
  diagnostic_date?: string;

  @IsOptional()
  @IsString()
  diagnosis_details?: string;
}
