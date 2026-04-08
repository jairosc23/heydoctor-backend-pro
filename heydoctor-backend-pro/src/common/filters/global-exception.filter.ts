import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import * as Sentry from '@sentry/node';
import { ENV_CONFIG_TOKEN, type EnvConfig } from '../../config/env.config';

type ErrorBody = {
  statusCode: number;
  message: string | string[];
  path: string;
  requestId?: string;
  /** Class name of non-HTTP errors in non-production only. */
  error?: string;
};

@Catch()
@Injectable()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(
    @Inject(ENV_CONFIG_TOKEN)
    private readonly env: EnvConfig,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = request.requestId;

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();
      const payload = this.buildHttpPayload(raw, status, request.url, requestId);
      if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
        this.logger.warn(String(payload.message), {
          requestId,
          path: request.url,
          statusCode: status,
        });
        if (process.env.SENTRY_DSN?.trim()) {
          Sentry.captureException(exception, {
            tags: { requestId: requestId ?? 'none', httpStatus: String(status) },
            extra: { path: request.url, body: payload },
          });
        }
      }
      response.status(status).json(payload);
      return;
    }

    const err =
      exception instanceof Error ? exception : new Error(String(exception));
    this.logger.error(err.message, err.stack, {
      requestId,
      path: request.url,
    });
    if (process.env.SENTRY_DSN?.trim()) {
      Sentry.captureException(err, {
        tags: { requestId: requestId ?? 'none' },
        extra: { path: request.url },
      });
    }

    const body: ErrorBody = {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: this.env.isProduction
        ? 'Internal server error'
        : err.message,
      path: request.url,
    };
    if (requestId) {
      body.requestId = requestId;
    }
    if (!this.env.isProduction) {
      body.error = err.name;
    }
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(body);
  }

  private buildHttpPayload(
    raw: string | object,
    status: number,
    path: string,
    requestId?: string,
  ): ErrorBody {
    let message: string | string[] = 'Error';
    if (typeof raw === 'string') {
      message = raw;
    } else if (typeof raw === 'object' && raw !== null) {
      const o = raw as Record<string, unknown>;
      if (Array.isArray(o.message)) {
        message = o.message as string[];
      } else if (typeof o.message === 'string') {
        message = o.message;
      } else if (typeof o.error === 'string') {
        message = o.error;
      }
    }

    const body: ErrorBody = {
      statusCode: status,
      message,
      path,
    };
    if (requestId) {
      body.requestId = requestId;
    }
    if (!this.env.isProduction) {
      if (typeof raw === 'object' && raw !== null) {
        const o = raw as Record<string, unknown>;
        if (typeof o.error === 'string') {
          body.error = o.error;
        }
      }
    }
    return body;
  }
}
