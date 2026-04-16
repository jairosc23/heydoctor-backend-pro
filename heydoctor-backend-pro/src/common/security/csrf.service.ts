import { Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { CSRF_COOKIE_NAME } from './csrf.constants';

@Injectable()
export class CsrfService {
  /**
   * Genera token, añade **solo** la cookie `csrf_token` (nombre distinto a sesión/refresh).
   * No modifica ni sustituye otras `Set-Cookie` ya emitidas en la misma respuesta.
   */
  attach(res: Response): string {
    const token = randomBytes(32).toString('hex');
    this.setCookie(res, token);
    return token;
  }

  setCookie(res: Response, token: string): void {
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false,
      secure: true,
      sameSite: 'none',
      path: '/api',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  /**
   * Rutas mutantes públicas / webhooks que no llevan token CSRF del SPA.
   */
  isCsrfExempt(req: Request): boolean {
    const method = (req.method ?? 'GET').toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return true;
    }
    const path = (req.originalUrl?.split('?')[0] ?? req.url?.split('?')[0] ?? '')
      .replace(/\/$/, '');
    if (path.endsWith('/auth/login')) {
      return true;
    }
    if (path.endsWith('/auth/register')) {
      return true;
    }
    if (path.endsWith('/auth/magic-link')) {
      return true;
    }
    /**
     * El SPA (Vercel) llama refresh/logout con `credentials: include` y la cookie HttpOnly
     * `refresh_token`, pero sin cabecera `X-CSRF-Token` (igual patrón que login). Sin exención,
     * `CsrfMiddleware` responde 403 y la sesión parece “rota”.
     */
    if (path.endsWith('/auth/refresh')) {
      return true;
    }
    if (path.endsWith('/auth/logout')) {
      return true;
    }
    if (path.endsWith('/payku/webhook')) {
      return true;
    }
    /** SPA (Vercel): eventos de analítica sin cookie CSRF del API. */
    if (path.endsWith('/analytics/collect')) {
      return true;
    }
    return false;
  }

  requiresValidation(req: Request): boolean {
    const method = (req.method ?? 'GET').toUpperCase();
    if (method !== 'POST' && method !== 'PUT' && method !== 'PATCH' && method !== 'DELETE') {
      return false;
    }
    return !this.isCsrfExempt(req);
  }

  verifyDoubleSubmit(req: Request): boolean {
    const headerRaw = req.headers['x-csrf-token'];
    const header =
      typeof headerRaw === 'string'
        ? headerRaw.trim()
        : Array.isArray(headerRaw)
          ? headerRaw[0]?.trim() ?? ''
          : '';
    const cookieRaw = req.cookies?.[CSRF_COOKIE_NAME];
    const cookie =
      typeof cookieRaw === 'string' ? cookieRaw.trim() : '';
    return (
      header.length > 0 &&
      cookie.length > 0 &&
      header === cookie
    );
  }
}
