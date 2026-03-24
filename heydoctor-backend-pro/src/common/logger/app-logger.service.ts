import { Injectable, Logger, type LoggerService } from '@nestjs/common';
import { getCurrentRequestId } from '../request-context.storage';

/**
 * Wraps Nest Logger and prefixes messages with the HTTP correlation ID when
 * {@link getCurrentRequestId} is set (RequestIdMiddleware + AsyncLocalStorage).
 */
@Injectable()
export class AppLoggerService implements LoggerService {
  private readonly nestLogger: Logger;

  constructor(context: string) {
    this.nestLogger = new Logger(context);
  }

  private formatMessage(message: unknown): string {
    const text =
      typeof message === 'string' ? message : String(message ?? '');
    const requestId = getCurrentRequestId();
    if (requestId) {
      return `[requestId=${requestId}] ${text}`;
    }
    return text;
  }

  log(message: unknown, ...optionalParams: any[]): void {
    this.nestLogger.log(this.formatMessage(message), ...optionalParams);
  }

  error(message: unknown, ...optionalParams: any[]): void {
    this.nestLogger.error(this.formatMessage(message), ...optionalParams);
  }

  warn(message: unknown, ...optionalParams: any[]): void {
    this.nestLogger.warn(this.formatMessage(message), ...optionalParams);
  }

  debug(message: unknown, ...optionalParams: any[]): void {
    this.nestLogger.debug(this.formatMessage(message), ...optionalParams);
  }

  verbose(message: unknown, ...optionalParams: any[]): void {
    this.nestLogger.verbose(this.formatMessage(message), ...optionalParams);
  }
}
