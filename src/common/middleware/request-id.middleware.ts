import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * Assigns a unique correlation ID per HTTP request (`req.requestId`).
 * Use as Express middleware: `app.use(new RequestIdMiddleware().use)`.
 */
export class RequestIdMiddleware {
  use = (req: Request, _res: Response, next: NextFunction): void => {
    req.requestId = randomUUID();
    next();
  };
}
