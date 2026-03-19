import { Controller, Get, Post, Body } from '@nestjs/common';
import { Public } from './modules/auth/decorators/public.decorator';
import { AuthService } from './modules/auth/auth.service';

@Controller()
export class AppController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Get()
  getRoot() {
    return { status: 'ok', message: 'HeyDoctor NestJS API' };
  }

  @Public()
  @Get('health')
  getHealth() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Public()
  @Get('routes')
  getRoutes() {
    return {
      auth: 'POST /api/auth/login',
      health: 'GET /api/health',
    };
  }

  @Public()
  @Post('auth/login')
  async login(@Body() body: { email?: string; password?: string }) {
    return this.authService.login(
      body.email || '',
      body.password || '',
    );
  }
}
