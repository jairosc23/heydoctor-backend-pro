import type { LoggerService } from '@nestjs/common';
import { ChaosRuntimeService } from './chaos-runtime.service';

describe('ChaosRuntimeService', () => {
  const makeLog = (): LoggerService & { warn: jest.Mock } => ({
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  });

  afterEach(() => {
    delete process.env.CHAOS_REDIS_FAIL;
    delete process.env.CHAOS_QUEUE_FAIL;
    delete process.env.CHAOS_REPLICA_FAIL;
    delete process.env.CHAOS_SAMPLE_PERCENT;
    jest.restoreAllMocks();
  });

  it('shouldSimulate is false when flags are off', () => {
    const log = makeLog();
    const svc = new ChaosRuntimeService(log);
    expect(svc.shouldSimulate('redis')).toBe(false);
    expect(svc.shouldSimulate('queue')).toBe(false);
    expect(svc.shouldSimulate('replica')).toBe(false);
  });

  it('shouldSimulate respects sample percent (1–5%)', () => {
    process.env.CHAOS_REDIS_FAIL = 'true';
    process.env.CHAOS_SAMPLE_PERCENT = '5';
    jest.spyOn(Math, 'random').mockReturnValue(0.04);
    const svc = new ChaosRuntimeService(makeLog());
    expect(svc.shouldSimulate('redis')).toBe(true);

    jest.spyOn(Math, 'random').mockReturnValue(0.051);
    const svc2 = new ChaosRuntimeService(makeLog());
    expect(svc2.shouldSimulate('redis')).toBe(false);
  });

  it('logRuntime emits chaos_runtime with scenario', () => {
    const log = makeLog();
    const svc = new ChaosRuntimeService(log);
    svc.logRuntime('queue', { queue: 'email' });
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringMatching(/"msg":"chaos_runtime"/),
    );
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringMatching(/"scenario":"queue"/),
    );
  });
});
