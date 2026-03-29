import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('daily_metrics')
@Index(['date'], { unique: true })
export class DailyMetric {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ name: 'upgrades_total', type: 'int', default: 0 })
  upgradesTotal: number;

  @Column({ name: 'upgrades_sales', type: 'int', default: 0 })
  upgradesSales: number;

  @Column({ name: 'upgrades_support', type: 'int', default: 0 })
  upgradesSupport: number;

  @Column({ name: 'downgrades_refund', type: 'int', default: 0 })
  downgradesRefund: number;

  @Column({ name: 'consultations_created', type: 'int', default: 0 })
  consultationsCreated: number;

  @Column({ name: 'consultations_paid', type: 'int', default: 0 })
  consultationsPaid: number;

  @Column({ name: 'consultations_started', type: 'int', default: 0 })
  consultationsStarted: number;

  @Column({ name: 'consultations_completed', type: 'int', default: 0 })
  consultationsCompleted: number;

  @Column({ name: 'doctor_applications', type: 'int', default: 0 })
  doctorApplications: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
