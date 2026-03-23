import { Exclude } from 'class-transformer';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
} from 'typeorm';
import { Clinic } from '../clinic/clinic.entity';
import { UserRole } from './user-role.enum';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  /** Never expose in API responses; omitted from default SELECT (see UsersService). */
  @Exclude()
  @Column({ name: 'password_hash', select: false })
  passwordHash: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.DOCTOR,
  })
  role: UserRole;

  @ManyToOne(() => Clinic, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;

  /** FK column `clinic_id` (read-only mirror for queries / future JWT). */
  @RelationId((user: User) => user.clinic)
  clinicId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
