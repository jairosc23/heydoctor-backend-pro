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
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { logSafeList } from '../common/observability/safe-list-observability';
import { ConsultationsListQueryDto } from './dto/consultations-list-query.dto';
import { RequirePlan } from '../subscriptions/decorators/require-plan.decorator';
import { FeatureGuard } from '../subscriptions/guards/feature.guard';
import { SubscriptionPlan } from '../subscriptions/subscription.entity';
import { ConsultationsService } from './consultations.service';
import { CreateConsultationDto } from './dto/create-consultation.dto';
import { SignConsultationDto } from './dto/sign-consultation.dto';
import { UpdateConsultationDto } from './dto/update-consultation.dto';

@Controller('consultations')
@UseGuards(JwtAuthGuard)
export class ConsultationsController {
  private readonly apiLogger = new Logger('API');

  constructor(private readonly consultationsService: ConsultationsService) {}

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
  @UseGuards(FeatureGuard)
  @RequirePlan(SubscriptionPlan.PRO)
  getConsultationAi(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.consultationsService.getConsultationAi(id, user);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.consultationsService.findOne(id, user);
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
  @UseGuards(FeatureGuard)
  @RequirePlan(SubscriptionPlan.PRO)
  startCall(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.consultationsService.startCall(id, user);
  }

  @Post(':id/sign')
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
