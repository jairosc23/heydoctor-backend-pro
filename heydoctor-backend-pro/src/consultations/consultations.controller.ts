import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { ConsultationsListQueryDto } from './dto/consultations-list-query.dto';
import { RequirePlan } from '../subscriptions/decorators/require-plan.decorator';
import { FeatureGuard } from '../subscriptions/guards/feature.guard';
import { SubscriptionPlan } from '../subscriptions/subscription.entity';
import { AuditService } from '../audit/audit.service';
import { extractClientHttpMeta } from '../common/http/client-meta.util';
import { maskOptionalUuid } from '../common/observability/log-masking.util';
import { ThrottleRouteCost } from '../common/throttler/throttle-route-cost.decorator';
import { ConsultationsService } from './consultations.service';
import { CreateConsultationDto } from './dto/create-consultation.dto';
import { SignConsultationDto } from './dto/sign-consultation.dto';
import { UpdateConsultationDto } from './dto/update-consultation.dto';

@Controller('consultations')
@UseGuards(JwtAuthGuard)
export class ConsultationsController {
  private readonly logger = new Logger(ConsultationsController.name);
  private readonly apiLogger = new Logger('API');

  constructor(
    private readonly consultationsService: ConsultationsService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateConsultationDto,
  ) {
    return this.consultationsService.create(dto, user);
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ConsultationsListQueryDto,
  ) {
    if (!user?.sub) {
      throw new UnauthorizedException('Missing clinic context');
    }
    this.logger.log(
      JSON.stringify({
        msg: 'user_context',
        hasUser: !!user,
        hasSub: !!user?.sub,
        path: 'consultations.findAll',
      }),
    );
    logSafeList(this.apiLogger, {
      msg: 'consultations_list',
      page: query.page,
      limit: query.limit,
      offset: query.offset,
      filters: {
        hasPatient: !!query.patientId,
        hasStatus: !!query.status,
        hasSearch: !!query.search?.trim(),
        hasDateRange: !!(query.from || query.to),
      },
    });
    return this.consultationsService.findAll(user, query);
  }

  @Get(':id/ai')
  @ThrottleRouteCost(4)
  @UseGuards(FeatureGuard)
  @RequirePlan(SubscriptionPlan.PRO)
  getConsultationAi(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.consultationsService.getConsultationAi(id, user);
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request,
  ) {
    const consultation = await this.consultationsService.findOne(id, user);
    const meta = extractClientHttpMeta(req);
    await this.auditService.logSuccess({
      userId: user.sub,
      action: 'CONSULTATION_RECORD_ACCESS',
      resource: 'consultation',
      resourceId: id,
      clinicId: consultation.clinicId,
      httpStatus: 200,
      metadata: {
        ...meta,
        maskedUserId: maskOptionalUuid(user.sub),
        patientId: maskOptionalUuid(consultation.patient?.id),
        timestamp: new Date().toISOString(),
      },
    });
    return consultation;
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateConsultationDto,
  ) {
    return this.consultationsService.update(id, dto, user);
  }

  @Post(':id/start-call')
  @ThrottleRouteCost(2)
  @UseGuards(FeatureGuard)
  @RequirePlan(SubscriptionPlan.PRO)
  startCall(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.consultationsService.startCall(id, user);
  }

  @Post(':id/sign')
  @ThrottleRouteCost(3)
  sign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: SignConsultationDto,
  ) {
    return this.consultationsService.sign(id, dto, user);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.consultationsService.remove(id, user);
  }
}
