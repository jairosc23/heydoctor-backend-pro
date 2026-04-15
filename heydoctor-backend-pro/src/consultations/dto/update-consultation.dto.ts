import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  Validate,
} from 'class-validator';
import { IsDiagnosisCie10OkConstraint } from '../../common/validation/is-diagnosis-cie10-ok.constraint';
import { ConsultationStatus } from '../consultation-status.enum';

export class UpdateConsultationDto {
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  chiefComplaint?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  symptoms?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  @Validate(IsDiagnosisCie10OkConstraint)
  diagnosis?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  treatmentPlan?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  notes?: string;

  @IsOptional()
  @IsEnum(ConsultationStatus)
  status?: ConsultationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  region?: string;
}
