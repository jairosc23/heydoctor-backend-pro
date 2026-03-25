import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { QueryFailedError, Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { AuthorizationService } from '../authorization/authorization.service';
import {
  TELEMEDICINE_CONSENT_VERSION,
  TelemedicineConsent,
} from './consent.entity';

/** Respuesta API: sin IP ni user-agent (solo persistidos en BD para auditoría). */
export type TelemedicineConsentView = {
  id: string;
  userId: string;
  clinicId: string;
  consentGivenAt: Date;
  version: string;
  createdAt: Date;
};

function extractClientIp(req: Request): string | null {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string') {
    const first = xff.split(',')[0]?.trim();
    return first && first.length > 0 ? first : null;
  }
  if (Array.isArray(xff) && xff[0]) {
    return xff[0].split(',')[0]?.trim() ?? null;
  }
  const ip = req.ip;
  if (typeof ip === 'string' && ip.length > 0) {
    return ip;
  }
  const socketIp = req.socket?.remoteAddress;
  if (typeof socketIp === 'string' && socketIp.length > 0) {
    return socketIp;
  }
  return null;
}

function extractUserAgent(req: Request): string | null {
  const ua = req.headers['user-agent'];
  return typeof ua === 'string' && ua.length > 0 ? ua : null;
}

@Injectable()
export class ConsentService {
  constructor(
    @InjectRepository(TelemedicineConsent)
    private readonly consentsRepository: Repository<TelemedicineConsent>,
    private readonly authorizationService: AuthorizationService,
  ) {}

  private toView(entity: TelemedicineConsent): TelemedicineConsentView {
    return {
      id: entity.id,
      userId: entity.userId,
      clinicId: entity.clinicId,
      consentGivenAt: entity.consentGivenAt,
      version: entity.version,
      createdAt: entity.createdAt,
    };
  }

  /**
   * Registra consentimiento de telemedicina.
   * `clinicId` proviene de BD vía {@link AuthorizationService} (no del JWT).
   * Marca temporal del servidor en `consentGivenAt`.
   */
  async createConsent(
    authUser: AuthenticatedUser,
    req: Request,
  ): Promise<TelemedicineConsentView> {
    const { user, clinicId } =
      await this.authorizationService.getUserWithClinic(authUser);

    const version = TELEMEDICINE_CONSENT_VERSION;

    const existing = await this.consentsRepository.findOne({
      where: { userId: user.id, version },
    });
    if (existing) {
      return this.toView(existing);
    }

    const now = new Date();
    const row = this.consentsRepository.create({
      userId: user.id,
      clinicId,
      consentGivenAt: now,
      ip: extractClientIp(req),
      userAgent: extractUserAgent(req),
      version,
    });

    try {
      const saved = await this.consentsRepository.save(row);
      return this.toView(saved);
    } catch (e) {
      if (
        e instanceof QueryFailedError &&
        (e as { driverError?: { code?: string } }).driverError?.code ===
          '23505'
      ) {
        const again = await this.consentsRepository.findOne({
          where: { userId: user.id, version },
        });
        if (again) {
          return this.toView(again);
        }
      }
      throw e;
    }
  }
}
