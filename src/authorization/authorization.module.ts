import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Patient } from '../patients/patient.entity';
import { UsersModule } from '../users/users.module';
import { AuthorizationService } from './authorization.service';

@Module({
  imports: [UsersModule, TypeOrmModule.forFeature([Patient])],
  providers: [AuthorizationService],
  exports: [AuthorizationService],
})
export class AuthorizationModule {}
