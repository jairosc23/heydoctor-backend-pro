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
import { sanitizePathForLog } from '../http-path.util';

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
    console.error('GLOBAL_ERROR', exception);

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = request.requestId;
    const safePath =
      typeof request.url === 'string'
        ? sanitizePathForLog(request.url)
        : String(request.url ?? '');

    /** Temporal: error real en Railway (sin 4xx ruidosos: HttpException < 500). */
    const shouldCaptureForDebug =
      !(exception instanceof HttpException) ||
      exception.getStatus() >= HttpStatus.INTERNAL_SERVER_ERROR;
    if (exception instanceof Error && shouldCaptureForDebug) {
      this.logger.error(
        JSON.stringify({
          msg: 'runtime_error',
          name: exception.name,
          message: exception.message,
          stack: exception.stack,
          path: safePath,
          requestId: requestId ?? undefined,
        }),
      );
      if (process.env.SENTRY_DSN?.trim()) {
        Sentry.captureException(exception);
      }
    } else if (!(exception instanceof Error)) {
      this.logger.error(
        JSON.stringify({
          msg: 'runtime_non_error',
          value: String(exception),
          path: safePath,
          requestId: requestId ?? undefined,
        }),
      );
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();
      const payload = this.buildHttpPayload(raw, status, request.url, requestId);
      if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
        this.logger.warn(String(payload.message), {
          requestId,
          path: safePath,
          statusCode: status,
        });
      }
      response.status(status).json(payload);
      return;
    }

    const err =
      exception instanceof Error ? exception : new Error(String(exception));

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
