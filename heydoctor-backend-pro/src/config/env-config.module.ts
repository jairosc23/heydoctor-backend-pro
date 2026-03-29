import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvConfig, ENV_CONFIG_TOKEN } from './env.config';

@Global()
@Module({
  providers: [
    {
      provide: ENV_CONFIG_TOKEN,
      useFactory: (config: ConfigService) => new EnvConfig(config),
      inject: [ConfigService],
    },
  ],
  exports: [ENV_CONFIG_TOKEN],
})
export class EnvConfigModule {}
