import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import {
  AuthService,
  type ActiveSessionView,
  type MeResponse,
  type RequestContext,
} from './auth.service';
import type { AuthenticatedUser } from './strategies/jwt.strategy';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { jwtTtlToMs } from './jwt-ttl.util';

const REFRESH_COOKIE = 'refresh_token';
const DEFAULT_REFRESH_MS = 7 * 24 * 60 * 60 * 1000;

function cookieOptions(
  isProduction: boolean,
): {
  httpOnly: true;
  secure: boolean;
  sameSite: 'none' | 'lax';
  path: string;
} {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/api/auth',
  };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  private refreshCookieMaxAgeMs(): number {
    return jwtTtlToMs(
      this.config.get<string>('JWT_REFRESH_TTL'),
      DEFAULT_REFRESH_MS,
    );
  }

  private setRefreshCookie(res: Response, token: string): void {
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie(REFRESH_COOKIE, token, {
      ...cookieOptions(isProd),
      maxAge: this.refreshCookieMaxAgeMs(),
    });
  }

  private clearRefreshCookie(res: Response): void {
    const isProd = process.env.NODE_ENV === 'production';
    res.clearCookie(REFRESH_COOKIE, cookieOptions(isProd));
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: AuthenticatedUser): Promise<MeResponse> {
    return this.authService.getMe(user.sub);
  }

  @Post('revoke-all')
  @UseGuards(JwtAuthGuard)
  async revokeAllSessions(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<{ success: true }> {
    await this.authService.revokeAllSessionsForCurrentUser(
      user.sub,
      extractContext(req),
    );
    return { success: true };
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  listSessions(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ActiveSessionView[]> {
    return this.authService.listActiveSessions(user.sub);
  }

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ctx = extractContext(req);
    const result = await this.authService.register(dto);
    const refreshToken = await this.authService.createRefreshToken(
      result.user.id,
      ctx,
    );
    this.setRefreshCookie(res, refreshToken);
    return { access_token: result.access_token, user: result.user };
  }

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ctx = extractContext(req);
    const result = await this.authService.login(dto, ctx);
    const refreshToken = await this.authService.createRefreshToken(
      result.user.id,
      ctx,
    );
    this.setRefreshCookie(res, refreshToken);
    return { access_token: result.access_token, user: result.user };
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawToken = req.cookies?.[REFRESH_COOKIE];
    if (!rawToken) {
      throw new UnauthorizedException('No refresh token');
    }

    const ctx = extractContext(req);
    const { accessToken, newRefreshToken } =
      await this.authService.validateAndRotateRefreshToken(rawToken, ctx);

    this.setRefreshCookie(res, newRefreshToken);
    return { access_token: accessToken };
  }

  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ctx = extractContext(req);
    const rawToken = req.cookies?.[REFRESH_COOKIE];
    await this.authService.performLogout(rawToken, ctx);
    this.clearRefreshCookie(res);
    return { ok: true };
  }
}

function extractContext(req: Request): RequestContext {
  const forwarded = req.headers['x-forwarded-for'];
  const ip =
    typeof forwarded === 'string'
      ? forwarded.split(',')[0].trim()
      : (req.ip ?? null);
  const userAgent =
    (req.headers['user-agent'] as string | undefined) ?? null;
  return { ip, userAgent };
}
