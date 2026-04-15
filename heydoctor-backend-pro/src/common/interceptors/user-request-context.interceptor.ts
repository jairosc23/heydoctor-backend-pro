import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { mergeRequestContext } from '../request-context.storage';
import { maskOptionalUuid } from '../observability/log-masking.util';

type RequestWithJwtUser = Request & { user?: { sub?: string } };

/**
 * After JWT guards run, merges a masked `userId` into AsyncLocalStorage so
 * {@link AppLoggerService} can attach it to structured logs (no raw UUID / PII).
 */
@Injectable()
export class UserRequestContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() === 'http') {
      const req = context.switchToHttp().getRequest<RequestWithJwtUser>();
      const sub = req.user?.sub;
      if (typeof sub === 'string' && sub.trim()) {
        mergeRequestContext({ userId: maskOptionalUuid(sub) });
      }
    }
    return next.handle();
  }
}
