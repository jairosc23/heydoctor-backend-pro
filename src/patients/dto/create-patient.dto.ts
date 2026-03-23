import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

export class CreatePatientDto {
  @IsString()
  @MinLength(1, { message: 'name is required' })
  @MaxLength(200)
  name: string;

  @IsEmail({}, { message: 'email must be a valid email' })
  email: string;
}
