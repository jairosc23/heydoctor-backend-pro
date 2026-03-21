import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { ClinicalRecord } from './clinical-record.entity';
import { Consultation } from './consultation.entity';
import { Cie10Code } from './cie10-code.entity';
import { Doctor } from './doctor.entity';
import { Patient } from './patient.entity';
import { Clinic } from './clinic.entity';

/**
 * Diagnosis entity - matches Strapi api::diagnostic.diagnostic.
 * One-to-one with Consultation (appointment). Direct link to clinical decision.
 */
@Entity('diagnostics')
export class Diagnosis {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Consultation (appointment in Strapi) - one-to-one. Primary relation. */
  @Column('uuid', { nullable: true })
  consultationId: string | null;

  @Column('uuid', { nullable: true })
  clinicalRecordId: string | null;

  @Column('uuid', { nullable: true })
  doctorId: string | null;

  @Column('uuid', { nullable: true })
  patientId: string | null;

  @Column('uuid', { nullable: true })
  clinicId: string | null;

  /** ICD/CIE-10 code reference. */
  @Column('uuid', { nullable: true })
  cie10CodeId: string | null;

  @Column({ type: 'date' })
  diagnostic_date: Date;

  /** Clinical description of the diagnosis (Strapi: diagnosis_details). */
  @Column({ name: 'diagnosis_details', type: 'text', nullable: true })
  diagnosis_details: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @OneToOne(() => Consultation, (c) => c.diagnostic, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'consultationId' })
  consultation: Consultation | null;

  @ManyToOne(() => ClinicalRecord, (cr) => cr.diagnostics, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'clinicalRecordId' })
  clinical_record: ClinicalRecord | null;

  @ManyToOne(() => Cie10Code, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'cie10CodeId' })
  cie_10_code: Cie10Code | null;

  @ManyToOne(() => Doctor, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'doctorId' })
  doctor: Doctor | null;

  @ManyToOne(() => Patient, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'patientId' })
  patient: Patient | null;

  @ManyToOne(() => Clinic, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'clinicId' })
  clinic: Clinic | null;
}
