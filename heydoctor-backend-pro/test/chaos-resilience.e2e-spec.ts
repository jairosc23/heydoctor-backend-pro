/**
 * Humo e2e para caos operativo: rutas exentas de shedding siguen respondiendo
 * mientras la app está levantada (p. ej. sin Redis de colas en el entorno de test).
 */
import { INestApplication, RequestMethod, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Chaos resilience (e2e smoke)', () => {
  let app: INestApplication<App>;

  beforeAll(() => {
    if (!process.env.DATABASE_URL) {
      process.env.DATABASE_URL =
        'postgresql://postgres:postgres@127.0.0.1:5432/heydoctor_test';
    }
    if (!process.env.JWT_SECRET) {
      process.env.JWT_SECRET = 'e2e-test-jwt-secret-min-32-chars!!';
    }
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api', {
      exclude: [
        { path: '/', method: RequestMethod.GET },
        { path: 'health', method: RequestMethod.GET },
        { path: 'healthz', method: RequestMethod.GET },
      ],
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('health endpoints stay available (load shed exempt)', async () => {
    await request(app.getHttpServer()).get('/_health').expect(200);
    await request(app.getHttpServer()).get('/health').expect(200);
    await request(app.getHttpServer()).get('/api/health').expect(200);
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        msg: 'chaos_validation',
        scenario: 'e2e_health_exempt',
        outcome: '200',
      }),
    );
  });
});
