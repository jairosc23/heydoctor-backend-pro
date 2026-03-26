import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { UserRole } from '../users/user-role.enum';
import { LegalPdfService } from './legal-pdf.service';

@Controller('legal')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.DOCTOR)
export class LegalPdfController {
  constructor(private readonly legalPdfService: LegalPdfService) {}

  @Get('consultation/:id/pdf')
  async consultationPdf(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<StreamableFile> {
    const { buffer, fileName } =
      await this.legalPdfService.generateConsultationPdf(id, user);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${fileName}"`,
    });
  }
}
