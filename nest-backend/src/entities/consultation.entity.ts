import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Patient } from './patient.entity';
import { Doctor } from './doctor.entity';
import { Clinic } from './clinic.entity';
import { ClinicalRecord } from './clinical-record.entity';
import { Diagnosis } from './diagnosis.entity';
import { LabOrder } from './lab-order.entity';
import { Prescription } from './prescription.entity';

/** Ciclo clínico: draft → in_progress → completed → signed → locked (sin ediciones). */
export type ConsultationStatus =
  | 'draft'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'signed'
  | 'locked';

@Entity('appointments')
export class Consultation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  patientId: string;

  @Column('uuid')
  doctorId: string;

  @Column('uuid')
  clinicId: string;

  @Column('uuid', { nullable: true })
  clinicalRecordId: string | null;

  @Column({ type: 'integer', default: 45 })
  duration: number;

  @Column({ name: 'date', type: 'timestamp' })
  date: Date;

  @Column({ default: 'scheduled' })
  status: ConsultationStatus;

  @Column({ default: false })
  confirmed: boolean;

  @Column({ name: 'appointment_reason', type: 'text', nullable: true })
  appointment_reason: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'jsonb', nullable: true })
  files: Record<string, unknown>[] | null;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Patient, (p) => p.consultations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @ManyToOne(() => Doctor, (d) => d.consultations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'doctorId' })
  doctor: Doctor;

  @ManyToOne(() => Clinic, (c) => c.consultations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinicId' })
  clinic: Clinic;

  @ManyToOne(() => ClinicalRecord, (cr) => cr.consultations, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'clinicalRecordId' })
  clinical_record: ClinicalRecord | null;

  @OneToOne(() => Diagnosis, (d) => d.consultation, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  diagnostic: Diagnosis | null;

  @OneToMany(() => LabOrder, (l) => l.consultation)
  lab_orders: LabOrder[];

  @OneToMany(() => Prescription, (p) => p.consultation)
  prescriptions: Prescription[];
}
