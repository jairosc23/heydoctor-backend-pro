import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { logSafeList } from '../common/observability/safe-list-observability';
import { PatientsListQueryDto } from './dto/patients-list-query.dto';
import {
  maskEmail,
  maskOptionalUuid,
  maskUuid,
} from '../common/observability/log-masking.util';
import { extractClientHttpMeta } from '../common/http/client-meta.util';
import { AuditService } from '../audit/audit.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { PatientsService } from './patients.service';

@UseGuards(JwtAuthGuard)
@Controller('patients')
export class PatientsController {
  private readonly logger = new Logger(PatientsController.name);
  private readonly apiLogger = new Logger('API');

  constructor(
    private readonly patientsService: PatientsService,
    private readonly auditService: AuditService,
  ) {}

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
    // JWT no expone clinicId; la clínica se resuelve en el servicio. Requiere sub.
    if (!user?.sub) {
      throw new UnauthorizedException('Missing clinic context');
    }
    this.logger.log(
      JSON.stringify({
        msg: 'user_context',
        hasUser: !!user,
        hasSub: !!user?.sub,
        path: 'patients.findAll',
      }),
    );
    logSafeList(this.apiLogger, {
      msg: 'patients_list',
      page: pagination.page,
      limit: pagination.limit,
      offset: pagination.offset,
      filters: {
        hasSearch: !!pagination.search?.trim(),
      },
    });
    return this.patientsService.findAll(user, pagination);
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request,
  ) {
    this.logRequest(
      `findOne ${maskUuid(id)} requested by user ${maskUuid(user.sub)} (${maskEmail(user.email)})`,
    );
    const patient = await this.patientsService.findOne(id, user);
    const meta = extractClientHttpMeta(req);
    await this.auditService.logSuccess({
      userId: user.sub,
      action: 'PATIENT_RECORD_ACCESS',
      resource: 'patient',
      resourceId: id,
      clinicId: patient.clinicId,
      httpStatus: 200,
      metadata: {
        ...meta,
        maskedUserId: maskOptionalUuid(user.sub),
        timestamp: new Date().toISOString(),
      },
    });
    return patient;
  }

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePatientDto,
  ) {
    this.logRequest(
      `create requested by user ${maskUuid(user.sub)} (${maskEmail(user.email)})`,
    );
    try {
      return await this.patientsService.create(dto, user);
    } catch (error) {
      console.error('CREATE_PATIENT_ERROR', error);
      throw error;
    }
  }
}
