import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
import { MagicLinkDto } from './dto/magic-link.dto';
import { RegisterDto } from './dto/register.dto';
import { jwtTtlToMs } from './jwt-ttl.util';
import { RevokeAllRateLimitGuard } from './revoke-all-rate-limit.guard';
import { CsrfService } from '../common/security/csrf.service';

/**
 * Refresh rotable en DB + cookie HttpOnly en el dominio del API.
 * - TTL access: `JWT_ACCESS_TTL` (p. ej. 15m); refresh: `JWT_REFRESH_TTL` (p. ej. 7d).
 * - Refresh: path `/api/auth` (login, refresh, logout).
 * - Access JWT: cookie `heydoctor_session`, path `/api` (todas las rutas API + WebRTC HTTP).
 * - Producción: `SameSite=None`, `Secure=true`.
 */
const REFRESH_COOKIE = 'refresh_token';
const SESSION_COOKIE = 'heydoctor_session';
const DEFAULT_REFRESH_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_ACCESS_MS = 15 * 60 * 1000;

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

function sessionCookieOptions(
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
    path: '/api',
  };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
    private readonly csrfService: CsrfService,
  ) {}

  /** Token CSRF + cookie `csrf_token` (no HttpOnly); para SPAs cross-origin usar el valor del JSON en `X-CSRF-Token`. */
  @Get('csrf')
  getCsrf(@Res({ passthrough: true }) res: Response): { csrfToken: string } {
    return { csrfToken: this.csrfService.attach(res) };
  }

  private refreshCookieMaxAgeMs(): number {
    return jwtTtlToMs(
      this.config.get<string>('JWT_REFRESH_TTL'),
      DEFAULT_REFRESH_MS,
    );
  }

  private sessionCookieMaxAgeMs(): number {
    return jwtTtlToMs(
      this.config.get<string>('JWT_ACCESS_TTL'),
      DEFAULT_ACCESS_MS,
    );
  }

  private setRefreshCookie(res: Response, token: string): void {
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie(REFRESH_COOKIE, token, {
      ...cookieOptions(isProd),
      maxAge: this.refreshCookieMaxAgeMs(),
    });
  }

  private setSessionCookie(res: Response, accessToken: string): void {
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie(SESSION_COOKIE, accessToken, {
      ...sessionCookieOptions(isProd),
      maxAge: this.sessionCookieMaxAgeMs(),
    });
  }

  private clearRefreshCookie(res: Response): void {
    const isProd = process.env.NODE_ENV === 'production';
    res.clearCookie(REFRESH_COOKIE, cookieOptions(isProd));
  }

  private clearSessionCookie(res: Response): void {
    const isProd = process.env.NODE_ENV === 'production';
    res.clearCookie(SESSION_COOKIE, sessionCookieOptions(isProd));
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: AuthenticatedUser): Promise<MeResponse> {
    return this.authService.getMe(user.sub);
  }

  @Post('revoke-all')
  @UseGuards(JwtAuthGuard, RevokeAllRateLimitGuard)
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

  @Post('sessions/:sessionId/revoke')
  @UseGuards(JwtAuthGuard)
  async revokeOneSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', new ParseUUIDPipe({ version: '4' })) sessionId: string,
    @Req() req: Request,
  ): Promise<{ ok: true }> {
    await this.authService.revokeSessionById(
      user.sub,
      sessionId,
      extractContext(req),
    );
    return { ok: true };
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
    this.setSessionCookie(res, result.access_token);
    const csrfToken = this.csrfService.attach(res);
    return {
      access_token: result.access_token,
      user: result.user,
      csrfToken,
    };
  }

  @Post('magic-link')
  async magicLink(
    @Body() dto: MagicLinkDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ctx = extractContext(req);
    const result = await this.authService.exchangeMagicLink(dto.token, ctx);
    const refreshToken = await this.authService.createRefreshToken(
      result.user.id,
      ctx,
    );
    this.setRefreshCookie(res, refreshToken);
    this.setSessionCookie(res, result.access_token);
    const csrfToken = this.csrfService.attach(res);
    return {
      access_token: result.access_token,
      user: result.user,
      csrfToken,
    };
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
    this.setSessionCookie(res, result.access_token);
    const csrfToken = this.csrfService.attach(res);
    return {
      access_token: result.access_token,
      user: result.user,
      csrfToken,
    };
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
    this.setSessionCookie(res, accessToken);
    const csrfToken = this.csrfService.attach(res);
    return { access_token: accessToken, csrfToken };
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
    this.clearSessionCookie(res);
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
