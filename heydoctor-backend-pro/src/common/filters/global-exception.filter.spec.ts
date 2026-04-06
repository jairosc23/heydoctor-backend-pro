import { HttpException, Logger } from '@nestjs/common';
import type { EnvConfig } from '../../config/env.config';
import { GlobalExceptionFilter } from './global-exception.filter';

beforeAll(() => {
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});

function mockRes() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(n: number) {
      this.statusCode = n;
      return this;
    },
    json(b: unknown) {
      this.body = b;
      return this;
    },
  };
  return res;
}

describe('GlobalExceptionFilter', () => {
  it('returns generic 500 message in production for unknown errors', () => {
    const env = { isProduction: true } as EnvConfig;
    const filter = new GlobalExceptionFilter(env);
    const res = mockRes() as any;
    filter.catch(new Error('internal secret'), {
      switchToHttp: () => ({
        getResponse: () => res,
        getRequest: () => ({ url: '/api/x' }),
      }),
    } as any);
    expect(res.statusCode).toBe(500);
    expect((res.body as any).message).toBe('Internal server error');
    expect((res.body as any).error).toBeUndefined();
  });

  it('includes requestId for HttpException', () => {
    const env = { isProduction: true } as EnvConfig;
    const filter = new GlobalExceptionFilter(env);
    const res = mockRes() as any;
    filter.catch(new HttpException('missing', 404), {
      switchToHttp: () => ({
        getResponse: () => res,
        getRequest: () => ({ url: '/api/r', requestId: 'rid-1' }),
      }),
    } as any);
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual(
      expect.objectContaining({
        statusCode: 404,
        message: 'missing',
        path: '/api/r',
        requestId: 'rid-1',
      }),
    );
  });
});
