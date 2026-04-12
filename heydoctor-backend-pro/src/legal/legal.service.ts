import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { AuditService } from '../audit/audit.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { Consultation } from '../consultations/consultation.entity';
import { User } from '../users/user.entity';
import {
  formatLegalConsultationsCsv,
  type LegalConsultationExportRow,
} from './legal-export-csv';

type RawLegalRow = {
  consultationId: string;
  createdAt: Date;
  doctorId: string;
  patientId: string;
  consentId: string | null;
  consentVersion: string | null;
  consentGivenAt: Date | null;
  consentIp: string | null;
  consentUserAgent: string | null;
};

@Injectable()
export class LegalService {
  constructor(
    @InjectRepository(Consultation)
    private readonly consultationsRepository: Repository<Consultation>,
    private readonly authorizationService: AuthorizationService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Consultas de la clínica del administrador con consentimiento y médico enlazados.
   * Valores de consentimiento: snapshot en `consultations` si existe; si no, fila en `telemedicine_consents`.
   */
  async exportLegalConsultationsCsv(
    authUser: AuthenticatedUser,
  ): Promise<{ csv: string; rowCount: number; clinicId: string }> {
    const { clinicId } =
      await this.authorizationService.getUserWithClinic(authUser);

    const raw = await this.consultationsRepository
      .createQueryBuilder('c')
      .innerJoin('c.clinic', 'clinic')
      .leftJoin('c.consent', 'tc')
      .leftJoin(User, 'doctor', 'doctor.id = "c"."doctor_id"')
      .where('clinic.id = :clinicId', { clinicId })
      .select('"c"."id"', 'consultationId')
      .addSelect('"c"."created_at"', 'createdAt')
      .addSelect('"c"."doctor_id"', 'doctorId')
      .addSelect('"c"."patient_id"', 'patientId')
      .addSelect('"c"."consent_id"', 'consentId')
      .addSelect('COALESCE("c"."consent_version", tc.version)', 'consentVersion')
      .addSelect(
        'COALESCE("c"."consent_given_at", tc.consent_given_at)',
        'consentGivenAt',
      )
      .addSelect('COALESCE("c"."consent_ip", tc.ip)', 'consentIp')
      .addSelect(
        'COALESCE("c"."consent_user_agent", tc.user_agent)',
        'consentUserAgent',
      )
      .orderBy('"c"."created_at"', 'ASC')
      .getRawMany<RawLegalRow>();

    const rows: LegalConsultationExportRow[] = raw.map((r) => ({
      consultationId: r.consultationId,
      createdAt: r.createdAt,
      doctorId: r.doctorId,
      patientId: r.patientId,
      consentId: r.consentId,
      consentVersion: r.consentVersion,
      consentGivenAt: r.consentGivenAt,
      consentIp: r.consentIp,
      consentUserAgent: r.consentUserAgent,
    }));

    const csv = formatLegalConsultationsCsv(rows);

    void this.auditService.logSuccess({
      userId: authUser.sub,
      action: 'LEGAL_EXPORT_DETAIL',
      resource: 'legal',
      resourceId: null,
      clinicId,
      httpStatus: 200,
      metadata: {
        rowCount: rows.length,
        exportType: 'consultations_consent_csv',
      },
    });

    return { csv, rowCount: rows.length, clinicId };
  }
}
