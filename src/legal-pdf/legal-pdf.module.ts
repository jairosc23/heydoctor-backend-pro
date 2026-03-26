import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { Consultation } from '../consultations/consultation.entity';
import { LegalPdfController } from './legal-pdf.controller';
import { LegalPdfService } from './legal-pdf.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Consultation]),
    AuthorizationModule,
    AuthModule,
  ],
  controllers: [LegalPdfController],
  providers: [LegalPdfService],
})
export class LegalPdfModule {}
