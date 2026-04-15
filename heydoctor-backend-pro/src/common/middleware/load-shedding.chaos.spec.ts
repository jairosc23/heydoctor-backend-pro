/**
 * Caos: shedding bajo QPS alto (umbral vía env). Aislado para cargar el middleware
 * después de fijar LOAD_SHED_QPS.
 */
import type { Request, Response } from 'express';
import type { HttpLoadTrackerService } from '../observability/http-load-tracker.service';
import type { MitigationHooksService } from '../resilience/mitigation-hooks.service';
import type { SuspiciousTrafficService } from '../security/suspicious-traffic.service';

describe('Chaos: load shedding under high QPS', () => {
  const prevQps = process.env.LOAD_SHED_QPS;
  let LoadSheddingMiddleware: typeof import('./load-shedding.middleware').LoadSheddingMiddleware;

  beforeAll(() => {
    process.env.LOAD_SHED_QPS = '100';
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      LoadSheddingMiddleware =
        require('./load-shedding.middleware').LoadSheddingMiddleware;
    });
  });

  afterAll(() => {
    if (prevQps === undefined) {
      delete process.env.LOAD_SHED_QPS;
    } else {
      process.env.LOAD_SHED_QPS = prevQps;
    }
  });

  it('returns 503 when smoothed incoming QPS exceeds threshold', () => {
    const httpLoad = {
      recordIncoming: jest.fn(),
      getSmoothedIncomingQps: jest.fn().mockReturnValue(150),
    };
    const mitigation = { notifyLoadPressure: jest.fn() };
    const suspicious = {
      recordIpHit: jest.fn(),
      getTemporaryBanRetryAfterSeconds: jest.fn().mockReturnValue(null),
    };

    const mw = new LoadSheddingMiddleware(
      httpLoad as unknown as HttpLoadTrackerService,
      mitigation as unknown as MitigationHooksService,
      suspicious as unknown as SuspiciousTrafficService,
    );

    const req = {
      originalUrl: '/api/patients',
      ip: '203.0.113.9',
    } as Request;
    const next = jest.fn();
    const res = {
      status: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    mw.use(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(mitigation.notifyLoadPressure).toHaveBeenCalled();
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        msg: 'chaos_validation',
        scenario: 'load_shedding',
        outcome: '503',
        path: '/api/patients',
      }),
    );
  });
});
