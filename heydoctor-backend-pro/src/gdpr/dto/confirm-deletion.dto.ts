import { IsBoolean } from 'class-validator';

export class ConfirmDeletionDto {
  @IsBoolean()
  confirm: boolean;
}
