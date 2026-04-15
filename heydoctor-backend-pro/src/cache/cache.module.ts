import { Global, Logger, Module } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import KeyvRedis from '@keyv/redis';
import { Keyv } from 'keyv';
import { SwrListRefreshLockService } from '../common/cache/swr-list-refresh-lock.service';

const logger = new Logger('CacheModule');

@Global()
@Module({
  imports: [
    NestCacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => {
        /** Railway Redis, Upstash u otro compatible con URL `redis(s)://`. */
        const redisUrl = process.env.REDIS_URL?.trim();
        if (redisUrl) {
          return {
            stores: [
              new Keyv({
                store: new KeyvRedis(redisUrl),
              }),
            ],
          };
        }
        logger.warn(
          'REDIS_URL is not set; using in-memory cache (not shared across instances).',
        );
        return {};
      },
    }),
  ],
  providers: [SwrListRefreshLockService],
  exports: [NestCacheModule, SwrListRefreshLockService],
})
export class AppCacheModule {}
