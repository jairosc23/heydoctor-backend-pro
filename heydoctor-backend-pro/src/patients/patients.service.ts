import { ConflictException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreatePatientDto } from './dto/create-patient.dto';

/** Paciente almacenado en memoria (sin persistencia en BD). */
export interface Patient {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

@Injectable()
export class PatientsService {
  private readonly patients: Patient[] = [
    {
      id: 'mock-001',
      name: 'Ana García',
      email: 'ana.garcia@example.com',
      createdAt: new Date('2025-01-10T10:00:00.000Z'),
    },
    {
      id: 'mock-002',
      name: 'Carlos López',
      email: 'carlos.lopez@example.com',
      createdAt: new Date('2025-02-15T14:30:00.000Z'),
    },
    {
      id: 'mock-003',
      name: 'María Fernández',
      email: 'maria.fernandez@example.com',
      createdAt: new Date('2025-03-01T09:15:00.000Z'),
    },
  ];

  findAll(): Patient[] {
    return [...this.patients].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  create(dto: CreatePatientDto): Patient {
    const email = dto.email.trim().toLowerCase();
    const exists = this.patients.some(
      (p) => p.email.toLowerCase() === email,
    );
    if (exists) {
      throw new ConflictException('A patient with this email already exists');
    }

    const patient: Patient = {
      id: randomUUID(),
      name: dto.name.trim(),
      email,
      createdAt: new Date(),
    };
    this.patients.push(patient);
    return patient;
  }
}
