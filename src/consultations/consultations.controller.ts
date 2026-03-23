import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConsultationsService } from './consultations.service';

@Controller('consultations')
@UseGuards(AuthGuard('jwt'))
export class ConsultationsController {
  constructor(private readonly consultationsService: ConsultationsService) {}

  @Get()
  findAll() {
    return this.consultationsService.findAll();
  }
}
