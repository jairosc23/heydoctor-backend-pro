import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePaymentSessionDto {
  @IsUUID('4')
  consultationId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(50_000_000)
  amount!: number;

  @IsString()
  @MaxLength(8)
  currency!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}
