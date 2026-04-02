import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class CreateAppointmentDto {
  @IsUUID('4')
  patientId: string;

  @IsDateString()
  startsAt: string;

  /** Obligatorio si el creador es admin (asignar médico de la misma clínica). */
  @IsOptional()
  @IsUUID('4')
  doctorId?: string;
}
