import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '../users/user.entity';
import { UserRole } from '../users/user-role.enum';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './types/jwt-payload.interface';

export type AuthUserView = {
  id: string;
  email: string;
  role: UserRole;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const user = await this.usersService.create(
      dto.email,
      dto.password,
      UserRole.DOCTOR,
    );
    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.validateCredentials(
      dto.email,
      dto.password,
    );
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.buildAuthResponse(user);
  }

  private async buildAuthResponse(user: User) {
    const publicUser = this.toPublicUser(user);
    const payload: JwtPayload = {
      sub: publicUser.id,
      email: publicUser.email,
      role: publicUser.role,
    };
    const access_token = await this.jwtService.signAsync(payload);
    return {
      access_token,
      user: publicUser,
    };
  }

  private toPublicUser(user: User): AuthUserView {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
    };
  }
}
