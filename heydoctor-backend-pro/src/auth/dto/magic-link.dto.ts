import { IsString, MinLength } from 'class-validator';

export class MagicLinkDto {
  @IsString()
  @MinLength(32, { message: 'token is required' })
  token!: string;
}
