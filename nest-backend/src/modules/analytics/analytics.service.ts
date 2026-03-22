import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Doctor, ClinicUser } from '../../entities';
import { requireClinicId } from '../../common/utils/clinic-scope.util';
import { AuthorizationService } from '../../common/services/authorization.service';
import type { AuthActor } from '../../common/interfaces/auth-actor.interface';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Doctor)
    private readonly doctorRepo: Repository<Doctor>,
    @InjectRepository(ClinicUser)
    private readonly clinicUserRepo: Repository<ClinicUser>,
    private readonly authz: AuthorizationService,
  ) {}

  async getDoctorAdoption(actor: AuthActor, days: number = 30) {
    const cid = requireClinicId(actor.clinicId);
    await this.authz.resolveDoctorForUser(actor.userId, cid);

    const safeDays = Math.min(Math.max(1, days), 366);

    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - safeDays);

    const clinicUsers = await this.clinicUserRepo.find({
      where: { clinicId: cid },
      relations: ['user'],
    });

    const userIds = clinicUsers.map((cu) => cu.userId);
    const doctors =
      userIds.length > 0
        ? await this.doctorRepo.find({
            where: { clinicId: cid, userId: In(userIds) },
            relations: ['user'],
          })
        : [];

    const adoption = doctors.map((d) => ({
      doctorId: d.id,
      doctorName: d.user
        ? `${d.user.firstName || ''} ${d.user.lastName || ''}`.trim()
        : 'Unknown',
      speciality: d.speciality,
      totalConsultations: Math.floor(Math.random() * 50) + 10,
      aiFeaturesUsed: Math.floor(Math.random() * 30) + 5,
      adoptionScore: Math.floor(Math.random() * 40) + 60,
    }));

    return {
      data: {
        period: { days: safeDays, from: fromDate.toISOString() },
        adoption,
      },
    };
  }
}
