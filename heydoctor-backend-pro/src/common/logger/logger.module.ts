import { Module } from '@nestjs/common';
import { AppLoggerService } from './app-logger.service';
import { APP_LOGGER } from './logger.tokens';

/** Application-wide logger context (Nest Logger prefix). */
export const APP_LOGGER_CONTEXT = 'HeyDoctor';

/**
 * Single registration of the structured logger. Consumers must:
 * - `imports: [LoggerModule]` in their feature module
 * - inject with `@Inject(APP_LOGGER) private readonly logger: AppLoggerService`
 */
@Module({
  providers: [
    {
      provide: APP_LOGGER,
      useFactory: () => new AppLoggerService(APP_LOGGER_CONTEXT),
    },
  ],
  exports: [APP_LOGGER],
})
export class LoggerModule {}
