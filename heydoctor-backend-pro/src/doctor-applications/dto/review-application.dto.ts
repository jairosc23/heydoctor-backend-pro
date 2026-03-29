import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApplicationStatus } from '../doctor-application.entity';

export class ReviewApplicationDto {
  @IsEnum(ApplicationStatus)
  status: ApplicationStatus.APPROVED | ApplicationStatus.REJECTED;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionReason?: string;
}
