import {
  IsEmail,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDoctorDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  specialty!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  clinic!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password!: string;
}
