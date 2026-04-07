import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { DoctorProfilesService } from '../doctor-profiles/doctor-profiles.service';
import { UsersService } from '../users/users.service';
import { RegisterDoctorDto } from './dto/register-doctor.dto';

function slugBase(name: string): string {
  const t = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return (t.length > 0 ? t : 'doctor').slice(0, 72);
}

@Injectable()
export class DoctorsRegistrationService {
  constructor(
    private readonly usersService: UsersService,
    private readonly profiles: DoctorProfilesService,
  ) {}

  async register(dto: RegisterDoctorDto): Promise<{
    userId: string;
    email: string;
    clinicId: string;
    profileSlug: string;
  }> {
    const user = await this.usersService.createDoctorWithNewClinic({
      email: dto.email,
      password: dto.password,
      name: dto.name,
      clinicName: dto.clinic,
    });

    const base = slugBase(dto.name);
    let slug = `${base}-${randomBytes(3).toString('hex')}`;
    let tries = 0;
    while (await this.profiles.isSlugTaken(slug)) {
      tries += 1;
      if (tries > 25) {
        slug = `${base}-${randomBytes(8).toString('hex')}`;
        break;
      }
      slug = `${base}-${randomBytes(3).toString('hex')}`;
    }

    await this.profiles.createProfile({
      userId: user.id,
      name: dto.name.trim().slice(0, 200),
      specialty: dto.specialty.trim().slice(0, 100),
      slug,
      country: '',
      bio: '',
    });

    return {
      userId: user.id,
      email: user.email,
      clinicId: user.clinicId,
      profileSlug: slug,
    };
  }
}
