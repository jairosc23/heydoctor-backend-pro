import {
  INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

function mergeSetCookieJar(setCookie: string[] | string | undefined): string {
  if (!setCookie) {
    return '';
  }
  const parts = Array.isArray(setCookie) ? setCookie : [setCookie];
  return parts
    .map((c) => String(c).split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
}

describe('Multi-tenant isolation (e2e)', () => {
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
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
    }
  });

  it('userB cannot access a patient created in clinic A (403)', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const password = 'e2e-pass-secure-1';
    const emailA = `mt-e2e-a-${suffix}@test.local`;
    const emailB = `mt-e2e-b-${suffix}@test.local`;

    const server = request(app.getHttpServer());

    const regA = await server
      .post('/api/auth/register')
      .send({ email: emailA, password })
      .expect(201);

    const regB = await server
      .post('/api/auth/register')
      .send({ email: emailB, password })
      .expect(201);

    const tokenA = regA.body.access_token as string;
    const tokenB = regB.body.access_token as string;
    const csrfA = regA.body.csrfToken as string;
    const jarA = mergeSetCookieJar(regA.headers['set-cookie']);

    const meA = await server
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const meB = await server
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect(meA.body.clinicId).toBeDefined();
    expect(meB.body.clinicId).toBeDefined();
    expect(meA.body.clinicId).not.toBe(meB.body.clinicId);

    const patientEmail = `patient-${suffix}@test.local`;
    const createPatientRes = await server
      .post('/api/patients')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Cookie', jarA)
      .set('X-CSRF-Token', csrfA)
      .send({ name: 'Paciente Aislado', email: patientEmail })
      .expect(201);

    const patientId = createPatientRes.body.id as string;
    expect(typeof patientId).toBe('string');
    expect(patientId.length).toBeGreaterThan(0);

    const intruder = await server
      .get(`/api/patients/${patientId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect([403, 404]).toContain(intruder.status);
    if (intruder.status === 403) {
      expect(intruder.body.message).toEqual(
        'Access denied for this patient',
      );
    }
  });
});
