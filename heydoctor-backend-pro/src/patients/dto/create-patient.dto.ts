import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Acepta `name` completo o `firstName` + `lastName` (compat. frontend legacy).
 * La composición final ocurre en {@link PatientsService.create}.
 */
export class CreatePatientDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsEmail({}, { message: 'email must be a valid email' })
  @MaxLength(320)
  email: string;
}
