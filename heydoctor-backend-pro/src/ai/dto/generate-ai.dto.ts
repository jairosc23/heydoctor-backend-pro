import { IsString } from 'class-validator';

export class GenerateAiDto {
  @IsString()
  reason: string;

  @IsString()
  notes: string;

  @IsString()
  diagnosis: string;

  @IsString()
  treatment: string;
}
