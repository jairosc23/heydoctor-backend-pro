import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
} from 'typeorm';
import { Clinic } from '../clinic/clinic.entity';

@Entity('patients')
@Index('UQ_patients_clinic_email', ['clinic', 'email'], { unique: true })
export class Patient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Clinic, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;

  /** FK `clinic_id` — read-only mirror for queries and tenant filters. */
  @RelationId((patient: Patient) => patient.clinic)
  clinicId: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column()
  email: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
