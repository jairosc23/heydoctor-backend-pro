import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ConsultationStatus } from '../consultation-status.enum';

/**
 * Query alineada con el frontend.
 * `clinicId` se acepta por compatibilidad pero **no se usa** (alcance solo por JWT).
 */
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

  /** Búsqueda libre sobre nombre/email del paciente enlazado. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  /** Ignorado: la clínica sale del usuario autenticado. */
  @IsOptional()
  @IsUUID('4')
  clinicId?: string;
}
