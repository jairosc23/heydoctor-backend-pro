import { TypeOrmModuleOptions } from '@nestjs/typeorm';

const baseConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: process.env.NODE_ENV !== 'production',
  logging: process.env.NODE_ENV === 'development',
  extra: {
    connectTimeout: 10000,
  },
};

// Railway: DATABASE_PRIVATE_URL (legacy) o DATABASE_URL; Heroku: DATABASE_URL
const databaseUrl =
  process.env.DATABASE_PRIVATE_URL || process.env.DATABASE_URL;

export const typeOrmConfig: TypeOrmModuleOptions = databaseUrl
  ? { ...baseConfig, url: databaseUrl }
  : {
      ...baseConfig,
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_DATABASE || 'nest_backend',
    };
