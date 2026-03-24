import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

const emptyToUndefined = ({ value }: { value: unknown }) =>
  value === '' || value === undefined ? undefined : value;

export class AuditExportQueryDto {
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID('4')
  clinicId?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(128)
  action?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsDateString()
  toDate?: string;
}
