import { Body, Controller, Get, Post } from '@nestjs/common';
import { CreatePatientDto } from './dto/create-patient.dto';
import { PatientsService } from './patients.service';

@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get()
  findAll() {
    return this.patientsService.findAll();
  }

  @Post()
  create(@Body() dto: CreatePatientDto) {
    return this.patientsService.create(dto);
  }
}
