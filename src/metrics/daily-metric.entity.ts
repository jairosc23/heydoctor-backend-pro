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

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
