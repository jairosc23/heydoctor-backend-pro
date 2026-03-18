import { Controller, Post, Body, Get } from '@nestjs/common';
import { Public } from './decorators/public.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Get()
  check() {
    return { ok: true, message: 'AuthController loaded', login: 'POST /api/auth/login' };
  }

  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }
}
