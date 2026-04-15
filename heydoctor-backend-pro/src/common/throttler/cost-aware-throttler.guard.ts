import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  type ThrottlerModuleOptions,
  type ThrottlerRequest,
  type ThrottlerStorage,
} from '@nestjs/throttler';
import type { Request } from 'express';
import { decode } from 'jsonwebtoken';
import { UserRole } from '../../users/user-role.enum';
import { THROTTLE_ROUTE_COST } from './throttle-route-cost.decorator';

const MAX_ROUTE_COST = 20;

/** Admin: menor coste efectivo (más cupo bajo mismo límite de bucket). */
function adaptiveRouteCost(cost: number, req: Record<string, unknown>): number {
  const r = req as unknown as Request;
  if (readThrottleRole(r) === UserRole.ADMIN) {
    return Math.max(1, Math.ceil(cost / 2));
  }
  return cost;
}

function readThrottleRole(req: Request): UserRole | undefined {
  const u = req.user as { role?: UserRole } | undefined;
  if (u?.role === UserRole.ADMIN || u?.role === UserRole.DOCTOR) {
    return u.role;
  }
  const auth = req.headers?.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    const token = auth.slice('Bearer '.length).trim();
    if (token.length > 0) {
      try {
        const payload = decode(token) as { role?: string } | null;
        if (payload?.role === UserRole.ADMIN || payload?.role === UserRole.DOCTOR) {
          return payload.role as UserRole;
        }
      } catch {
        /* token ilegible */
      }
    }
  }
  return undefined;
}

@Injectable()
export class CostAwareThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
  ) {
    super(options, storageService, reflector);
  }

  protected override async handleRequest(props: ThrottlerRequest): Promise<boolean> {
    const handler = props.context.getHandler();
    const classRef = props.context.getClass();
    const meta = this.reflector.getAllAndOverride<number>(THROTTLE_ROUTE_COST, [
      handler,
      classRef,
    ]);
    const baseCost = Math.min(
      MAX_ROUTE_COST,
      Math.max(1, Math.floor(typeof meta === 'number' && Number.isFinite(meta) ? meta : 1)),
    );
    const { req: reqEarly } = this.getRequestResponse(props.context);
    const cost = adaptiveRouteCost(baseCost, reqEarly);

    if (cost === 1) {
      return super.handleRequest(props);
    }

    const {
      context,
      limit,
      ttl,
      throttler,
      blockDuration,
      getTracker,
      generateKey,
    } = props;
    const { req, res } = this.getRequestResponse(context);
    const ignoreUserAgents =
      throttler.ignoreUserAgents ?? this.commonOptions.ignoreUserAgents;
    if (Array.isArray(ignoreUserAgents)) {
      const ua = req.headers?.['user-agent'];
      if (typeof ua === 'string') {
        for (const pattern of ignoreUserAgents) {
          if (pattern.test(ua)) {
            return true;
          }
        }
      }
    }

    const tracker = await getTracker(req, context);
    const throttlerName = throttler.name ?? 'default';
    const key = generateKey(context, tracker, throttlerName);

    let totalHits = 0;
    let timeToExpire = 0;
    let isBlocked = false;
    let timeToBlockExpire = 0;
    for (let i = 0; i < cost; i++) {
      const r = await this.storageService.increment(
        key,
        ttl,
        limit,
        blockDuration,
        throttlerName,
      );
      totalHits = r.totalHits;
      timeToExpire = r.timeToExpire;
      isBlocked = r.isBlocked;
      timeToBlockExpire = r.timeToBlockExpire;
      if (isBlocked) {
        break;
      }
    }

    const getThrottlerSuffix = (name: string) =>
      name === 'default' ? '' : `-${name}`;
    const setHeaders =
      throttler.setHeaders ?? this.commonOptions.setHeaders ?? true;

    if (isBlocked) {
      if (setHeaders) {
        res.header(
          `Retry-After${getThrottlerSuffix(throttlerName)}`,
          timeToBlockExpire,
        );
      }
      await this.throwThrottlingException(context, {
        limit,
        ttl,
        key,
        tracker,
        totalHits,
        timeToExpire,
        isBlocked,
        timeToBlockExpire,
      });
    }

    if (setHeaders) {
      const suffix = getThrottlerSuffix(throttlerName);
      res.header(`${this.headerPrefix}-Limit${suffix}`, limit);
      res.header(
        `${this.headerPrefix}-Remaining${suffix}`,
        Math.max(0, limit - totalHits),
      );
      res.header(`${this.headerPrefix}-Reset${suffix}`, timeToExpire);
    }
    return true;
  }
}
