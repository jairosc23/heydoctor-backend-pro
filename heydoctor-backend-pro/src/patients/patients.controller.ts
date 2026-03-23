import { Body, Controller, Get, Logger, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CreatePatientDto } from './dto/create-patient.dto';
import { PatientsService } from './patients.service';

@UseGuards(JwtAuthGuard)
@Controller('patients')
export class PatientsController {
  private readonly logger = new Logger(PatientsController.name);

  constructor(private readonly patientsService: PatientsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    this.logger.debug(`findAll requested by user ${user.sub} (${user.email})`);
    return this.patientsService.findAll();
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePatientDto,
  ) {
    this.logger.debug(`create requested by user ${user.sub} (${user.email})`);
    return this.patientsService.create(dto);
  }
}
