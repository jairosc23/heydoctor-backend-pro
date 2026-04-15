import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, MaxLength, Min, MinLength } from 'class-validator';

/** Query params for optional list pagination (patients, consultations). */
export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  /** Alternativa a `page`: desplazamiento directo (compatible con cliente legacy). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  /** Paginación por cursor (opaque). Si se envía, tiene prioridad sobre page/offset. */
  @IsOptional()
  @MinLength(1)
  @MaxLength(512)
  cursor?: string;
}
