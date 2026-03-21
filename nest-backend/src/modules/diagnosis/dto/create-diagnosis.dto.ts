import { IsString, IsOptional, IsUUID, IsDateString } from 'class-validator';

/** Matches Strapi api::diagnostic.diagnostic attributes. */
export class CreateDiagnosisDto {
  @IsUUID()
  consultationId: string;

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

  @IsDateString()
  diagnostic_date: string;

  /** Clinical description (Strapi: diagnosis_details). */
  @IsOptional()
  @IsString()
  diagnosis_details?: string;
}
