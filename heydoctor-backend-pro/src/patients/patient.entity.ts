import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
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

  /** Misma columna que `clinic`; `@Column` evita EntityPropertyNotFoundError en QueryBuilder. */
  @Column({ name: 'clinic_id', type: 'uuid' })
  clinicId: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column()
  email: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
