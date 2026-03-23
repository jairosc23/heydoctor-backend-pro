import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ConsultationStatus } from '../consultation-status.enum';

export class UpdateConsultationDto {
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  diagnosis?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  treatment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  notes?: string;

  @IsOptional()
  @IsEnum(ConsultationStatus)
  status?: ConsultationStatus;
}
