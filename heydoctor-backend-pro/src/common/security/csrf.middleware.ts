import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { CsrfService } from './csrf.service';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  constructor(private readonly csrf: CsrfService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    if (!this.csrf.requiresValidation(req)) {
      next();
      return;
    }
    if (!this.csrf.verifyDoubleSubmit(req)) {
      res.status(403).json({
        statusCode: 403,
        message: 'Invalid CSRF token',
        error: 'Forbidden',
      });
      return;
    }
    next();
  }
}
