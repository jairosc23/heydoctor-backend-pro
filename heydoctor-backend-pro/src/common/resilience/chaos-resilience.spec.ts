/**
 * Escenarios de caos para validar degradación en producción (sin orquestador externo).
 * Cobertura: caché/Redis, réplica + circuit breaker, load shedding + mitigación, BullMQ.
 */
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test, type TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { LoggerService } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import type { Repository } from 'typeorm';
import { UserRole } from '../../users/user-role.enum';
import type { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { Patient } from '../../patients/patient.entity';
import { PatientsService } from '../../patients/patients.service';
import { AuditService } from '../../audit/audit.service';
import { AuthorizationService } from '../../authorization/authorization.service';
import { APP_LOGGER } from '../logger/logger.tokens';
import {
  ReadReplicaCircuitService,
  type ReadReplicaCircuitLike,
} from '../database/read-replica-circuit.service';
import { withReadReplicaFallback } from '../database/read-replica-fallback.util';
import { HttpLoadTrackerService } from '../observability/http-load-tracker.service';
import { MitigationHooksService } from './mitigation-hooks.service';
import { SwrListRefreshLockService } from '../cache/swr-list-refresh-lock.service';
import { QueueProducerService } from '../../queue/queue-producer.service';

describe('Chaos resilience (production validation)', () => {
  const chaosLog = (scenario: string, detail: Record<string, unknown>) =>
    JSON.stringify({ msg: 'chaos_validation', scenario, ...detail });

  describe('1) Redis / cache failure → degraded cache, DB still serves', () => {
    let patientsService: PatientsService;
    const authUser: AuthenticatedUser = {
      sub: 'user-1',
      email: 'd@test.com',
      role: UserRole.DOCTOR,
    };

    beforeEach(async () => {
      const patientRow: Patient = {
        id: 'p1',
        clinicId: 'clinic-1',
        clinic: { id: 'clinic-1' } as Patient['clinic'],
        name: 'Paciente',
        email: 'p@test.com',
        createdAt: new Date(),
      };

      const qbMock = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        clone: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
        getMany: jest.fn().mockResolvedValue([patientRow]),
      };

      const repo = {
        createQueryBuilder: jest.fn().mockReturnValue(qbMock),
      } as unknown as Repository<Patient>;

      const log: LoggerService = {
        log: jest.fn((m) => {
          if (typeof m === 'string' && m.includes('chaos_validation')) return;
          /* noop */
        }),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        verbose: jest.fn(),
      };

      const cache = {
        get: jest.fn().mockRejectedValue(new Error('Redis connection refused')),
        set: jest.fn().mockRejectedValue(new Error('Redis connection refused')),
      } as unknown as Cache;

      const moduleRef: TestingModule = await Test.createTestingModule({
        providers: [
          PatientsService,
          { provide: getRepositoryToken(Patient), useValue: repo },
          { provide: AuthorizationService, useValue: {
              getUserWithClinic: jest
                .fn()
                .mockResolvedValue({ clinicId: 'clinic-1' }),
            },
          },
          { provide: AuditService, useValue: { logSuccess: jest.fn() } },
          { provide: APP_LOGGER, useValue: log },
          { provide: CACHE_MANAGER, useValue: cache },
          {
            provide: SwrListRefreshLockService,
            useValue: { scheduleRefresh: jest.fn() },
          },
          {
            provide: HttpLoadTrackerService,
            useValue: {
              getEntityListFreshMs: jest.fn().mockReturnValue(30_000),
              getSmoothedQps: jest.fn().mockReturnValue(0),
              recordIncoming: jest.fn(),
              recordRequest: jest.fn(),
            },
          },
          {
            provide: ReadReplicaCircuitService,
            useValue: {
              shouldAttemptReplica: () => true,
              recordReplicaSuccess: jest.fn(),
              recordReplicaFailure: jest.fn(),
            },
          },
        ],
      }).compile();

      patientsService = moduleRef.get(PatientsService);
    });

    it('findAll returns DB data when cache throws (chaos_redis_cache)', async () => {
      const out = await patientsService.findAll(authUser, {
        page: 1,
        limit: 20,
      });
      expect(out.data).toHaveLength(1);
      expect(out.data[0].id).toBe('p1');
      // eslint-disable-next-line no-console
      console.log(
        chaosLog('redis_cache_degraded', {
          outcome: 'served_from_db',
          rows: out.data.length,
        }),
      );
    });
  });

  describe('2) Read replica failure → fallback + circuit breaker', () => {
    it('withReadReplicaFallback uses primary when replica throws', async () => {
      const log: LoggerService = {
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        verbose: jest.fn(),
      };
      const primary = { tag: 'primary' };
      const readRepo = {} as Repository<{ id: string }>;
      const run = jest
        .fn()
        .mockRejectedValueOnce(new Error('replica timeout'))
        .mockResolvedValueOnce({ ok: true });

      const result = await withReadReplicaFallback(
        readRepo,
        primary as Repository<{ id: string }>,
        run,
        log,
        'chaos.test.replica',
      );

      expect(result).toEqual({ ok: true });
      expect(run).toHaveBeenCalledTimes(2);
      expect(run.mock.calls[0][0]).toBe(readRepo);
      expect(run.mock.calls[1][0]).toBe(primary);
      expect(log.warn).toHaveBeenCalled();
      const warnArg = (log.warn as jest.Mock).mock.calls[0][0] as string;
      expect(warnArg).toContain('read_replica_fallback');
      // eslint-disable-next-line no-console
      console.log(
        chaosLog('read_replica_fallback', { outcome: 'primary_used' }),
      );
    });

    it('ReadReplicaCircuitService opens after failures (env: 1 failure)', async () => {
      const prevF = process.env.READ_REPLICA_CIRCUIT_FAILURES;
      const prevMs = process.env.READ_REPLICA_CIRCUIT_OPEN_MS;
      process.env.READ_REPLICA_CIRCUIT_FAILURES = '1';
      process.env.READ_REPLICA_CIRCUIT_OPEN_MS = '5000';

      const log: LoggerService = {
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        verbose: jest.fn(),
      };

      const circuit = new ReadReplicaCircuitService(log);
      expect(circuit.shouldAttemptReplica()).toBe(true);

      circuit.recordReplicaFailure();
      expect(circuit.shouldAttemptReplica()).toBe(false);
      expect(log.warn).toHaveBeenCalled();
      const openLog = (log.warn as jest.Mock).mock.calls.find(
        (c) =>
          typeof c[0] === 'string' && c[0].includes('read_replica_circuit_open'),
      );
      expect(openLog).toBeDefined();

      if (prevF === undefined) delete process.env.READ_REPLICA_CIRCUIT_FAILURES;
      else process.env.READ_REPLICA_CIRCUIT_FAILURES = prevF;
      if (prevMs === undefined) delete process.env.READ_REPLICA_CIRCUIT_OPEN_MS;
      else process.env.READ_REPLICA_CIRCUIT_OPEN_MS = prevMs;

      // eslint-disable-next-line no-console
      console.log(
        chaosLog('read_replica_circuit', { outcome: 'open_after_failure' }),
      );
    });

    it('skips replica when circuit is open', async () => {
      const log: LoggerService = {
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        verbose: jest.fn(),
      };
      const circuit: ReadReplicaCircuitLike = {
          shouldAttemptReplica: () => false,
          recordReplicaSuccess: jest.fn(),
          recordReplicaFailure: jest.fn(),
        };
      const primary = { tag: 'p' };
      const readRepo = { tag: 'r' } as Repository<{ id: string }>;
      const run = jest.fn().mockResolvedValue({ from: 'primary' });

      const out = await withReadReplicaFallback(
        readRepo,
        primary as Repository<{ id: string }>,
        run,
        log,
        'chaos.circuit.skip',
        circuit,
      );

      expect(out).toEqual({ from: 'primary' });
      expect(run).toHaveBeenCalledTimes(1);
      expect(run).toHaveBeenCalledWith(primary);
      expect(circuit.recordReplicaFailure).not.toHaveBeenCalled();
      // eslint-disable-next-line no-console
      console.log(
        chaosLog('read_replica_circuit_skip', { outcome: 'primary_only' }),
      );
    });
  });

  describe('3) High QPS → mitigation hooks (see load-shedding.chaos.spec)', () => {
    it('MitigationHooksService boosts cache TTL under pressure', () => {
      const hooks = new MitigationHooksService();
      hooks.notifyLoadPressure(0.95);
      expect(hooks.getMitigationFreshBoostMs()).toBeGreaterThan(0);
      // eslint-disable-next-line no-console
      console.log(
        chaosLog('mitigation_cache_boost', {
          boostMs: hooks.getMitigationFreshBoostMs(),
        }),
      );
    });
  });

  describe('4) BullMQ / Redis queue failure → API continues', () => {
    it('addEmailJob logs queue_enqueue_degraded and returns undefined', async () => {
      const warn = jest.fn();
      const log: LoggerService = {
        log: jest.fn(),
        error: jest.fn(),
        warn,
        debug: jest.fn(),
        verbose: jest.fn(),
      };

      const failingQueue = {
        add: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      };

      const moduleRef = await Test.createTestingModule({
        providers: [
          QueueProducerService,
          { provide: APP_LOGGER, useValue: log },
          { provide: getQueueToken('email'), useValue: failingQueue },
          { provide: getQueueToken('pdf'), useValue: { add: jest.fn() } },
          { provide: getQueueToken('webhook'), useValue: { add: jest.fn() } },
        ],
      }).compile();

      const producer = moduleRef.get(QueueProducerService);
      const job = await producer.addEmailJob({ templateId: 't1', to: 'a@b.c' });

      expect(job).toBeUndefined();
      expect(warn).toHaveBeenCalled();
      const payload = warn.mock.calls[0][0] as string;
      expect(payload).toContain('queue_enqueue_degraded');
      expect(payload).toContain('email');
      // eslint-disable-next-line no-console
      console.log(
        chaosLog('bullmq_enqueue', { outcome: 'degraded_no_throw' }),
      );
    });
  });
});
