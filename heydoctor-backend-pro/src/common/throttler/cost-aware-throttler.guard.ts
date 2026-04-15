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
import { THROTTLE_ROUTE_COST } from './throttle-route-cost.decorator';

const MAX_ROUTE_COST = 20;

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
    const cost = Math.min(
      MAX_ROUTE_COST,
      Math.max(1, Math.floor(typeof meta === 'number' && Number.isFinite(meta) ? meta : 1)),
    );

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
