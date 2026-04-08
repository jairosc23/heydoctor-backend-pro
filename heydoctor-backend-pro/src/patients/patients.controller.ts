import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { PatientsListQueryDto } from './dto/patients-list-query.dto';
import {
  maskEmail,
  maskUuid,
} from '../common/observability/log-masking.util';
import { CreatePatientDto } from './dto/create-patient.dto';
import { PatientsService } from './patients.service';

@UseGuards(JwtAuthGuard)
@Controller('patients')
export class PatientsController {
  private readonly logger = new Logger(PatientsController.name);

  constructor(private readonly patientsService: PatientsService) {}

  /** Emits DEBUG in non-production, LOG in production (less noisy default levels). */
  private logRequest(message: string): void {
    if (process.env.NODE_ENV === 'production') {
      this.logger.log(message);
    } else {
      this.logger.debug(message);
    }
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: PatientsListQueryDto,
  ) {
    console.log('QUERY:', pagination);
    this.logRequest(
      `findAll requested by user ${maskUuid(user.sub)} (${maskEmail(user.email)})`,
    );
    return this.patientsService.findAll(user, pagination);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    this.logRequest(
      `findOne ${maskUuid(id)} requested by user ${maskUuid(user.sub)} (${maskEmail(user.email)})`,
    );
    return this.patientsService.findOne(id, user);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePatientDto,
  ) {
    this.logRequest(
      `create requested by user ${maskUuid(user.sub)} (${maskEmail(user.email)})`,
    );
    return this.patientsService.create(dto, user);
  }
}
