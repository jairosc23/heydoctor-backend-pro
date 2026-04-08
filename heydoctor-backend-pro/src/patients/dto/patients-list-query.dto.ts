import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

/** `clinicId` se acepta por compatibilidad; el listado usa solo la clínica del JWT. */
export class PatientsListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsUUID('4')
  clinicId?: string;
}
