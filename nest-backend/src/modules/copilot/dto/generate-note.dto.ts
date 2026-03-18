import { IsOptional, IsString, IsArray } from 'class-validator';

export class GenerateClinicalNoteDto {
  @IsOptional()
  @IsString()
  consultationId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  symptoms?: string[];

  @IsOptional()
  @IsString()
  clinical_notes?: string;

  @IsOptional()
  @IsString()
  patient_history?: string;

  @IsOptional()
  @IsArray()
  messages?: Array<{ role: string; content: string }>;
}
