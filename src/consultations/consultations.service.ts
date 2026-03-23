import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Consultation } from './consultation.entity';

@Injectable()
export class ConsultationsService {
  constructor(
    @InjectRepository(Consultation)
    private readonly consultationsRepository: Repository<Consultation>,
  ) {}

  async findAll(): Promise<Consultation[]> {
    return this.consultationsRepository.find({
      relations: { patient: true },
      order: { createdAt: 'DESC' },
    });
  }
}
