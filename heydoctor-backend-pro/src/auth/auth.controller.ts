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
import { AUTH_COOKIE_DOMAIN } from './auth-cookie-domain';
import { RevokeAllRateLimitGuard } from './revoke-all-rate-limit.guard';
import { CsrfService } from '../common/security/csrf.service';

/**
 * Cookies cross-site (Vercel → API): `SameSite=None` + `Secure` + `Domain` para el sitio médico.
 * Sesión `path: /`; refresh `path: /api/auth`.
 *
 * Requiere API en host bajo `*.heydoctor.health`; con otro host (p. ej. `*.railway.app`) el dominio no coincide y el navegador descarta Set-Cookie.
 */
const REFRESH_COOKIE = 'refresh_token';
const SESSION_COOKIE = 'heydoctor_session';
const DEFAULT_REFRESH_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_ACCESS_MS = 15 * 60 * 1000;

const CROSS_SITE_HTTP_ONLY_COOKIE_BASE = {
  httpOnly: true as const,
  secure: true as const,
  sameSite: 'none' as const,
  domain: AUTH_COOKIE_DOMAIN,
};

const REFRESH_COOKIE_PATH = '/api/auth';
const SESSION_COOKIE_PATH = '/';

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
    res.cookie(REFRESH_COOKIE, token, {
      ...CROSS_SITE_HTTP_ONLY_COOKIE_BASE,
      path: REFRESH_COOKIE_PATH,
      maxAge: this.refreshCookieMaxAgeMs(),
    });
  }

  private setSessionCookie(res: Response, accessToken: string): void {
    res.cookie(SESSION_COOKIE, accessToken, {
      ...CROSS_SITE_HTTP_ONLY_COOKIE_BASE,
      path: SESSION_COOKIE_PATH,
      maxAge: this.sessionCookieMaxAgeMs(),
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(REFRESH_COOKIE, {
      ...CROSS_SITE_HTTP_ONLY_COOKIE_BASE,
      path: REFRESH_COOKIE_PATH,
    });
  }

  private clearSessionCookie(res: Response): void {
    res.clearCookie(SESSION_COOKIE, {
      ...CROSS_SITE_HTTP_ONLY_COOKIE_BASE,
      path: SESSION_COOKIE_PATH,
    });
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
