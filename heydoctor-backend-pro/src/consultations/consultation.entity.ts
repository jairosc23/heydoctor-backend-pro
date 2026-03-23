import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('consultations')
export class Consultation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Referencia lógica al paciente (sin FK a tabla patients mientras pacientes vivan en memoria). */
  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
