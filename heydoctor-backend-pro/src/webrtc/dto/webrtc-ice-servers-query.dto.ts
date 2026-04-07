import { IsUUID } from 'class-validator';

export class WebrtcIceServersQueryDto {
  @IsUUID('4')
  consultationId!: string;
}
