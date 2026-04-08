import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ConsultationStatus } from '../consultation-status.enum';

/** Query alineada con el frontend (filtros opcionales + paginación). */
export class ConsultationsListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('4')
  patientId?: string;

  @IsOptional()
  @IsEnum(ConsultationStatus)
  status?: ConsultationStatus;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  /** Filtro por médico (misma clínica; llega del panel). */
  @IsOptional()
  @IsUUID('4')
  doctorId?: string;
}
