import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatePatientDto } from './dto/create-patient.dto';
import { Patient } from './patient.entity';

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient)
    private readonly patientsRepository: Repository<Patient>,
  ) {}

  async findAll(): Promise<Patient[]> {
    return this.patientsRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Patient> {
    const patient = await this.patientsRepository.findOne({ where: { id } });
    if (!patient) {
      throw new NotFoundException(`Patient ${id} not found`);
    }
    return patient;
  }

  async create(dto: CreatePatientDto): Promise<Patient> {
    const email = dto.email.toLowerCase();
    const existing = await this.patientsRepository.findOne({
      where: { email },
    });
    if (existing) {
      throw new ConflictException('A patient with this email already exists');
    }
    const entity = this.patientsRepository.create({
      name: dto.name.trim(),
      email,
      phone: dto.phone.trim(),
    });
    return this.patientsRepository.save(entity);
  }
}
