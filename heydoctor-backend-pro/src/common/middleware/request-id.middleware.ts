import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { enterRequestContext } from '../request-context.storage';

/** Accept inbound trace ids (load balancers, gateways); cap length to avoid abuse. */
const REQUEST_ID_MAX = 128;
const REQUEST_ID_MIN = 8;

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function pickRequestId(req: Request): string {
  const raw =
    req.headers['x-request-id'] ?? req.headers['x-correlation-id'];
  const header = Array.isArray(raw) ? raw[0] : raw;
  if (typeof header !== 'string') {
    return randomUUID();
  }
  const trimmed = header.trim();
  if (
    trimmed.length >= REQUEST_ID_MIN &&
    trimmed.length <= REQUEST_ID_MAX &&
    /^[\w\-:.]+$/.test(trimmed)
  ) {
    return trimmed;
  }
  return randomUUID();
}

function pickOptionalUuidHeader(
  value: string | string[] | undefined,
): string | undefined {
  if (value === undefined) return undefined;
  const v = Array.isArray(value) ? value[0] : value;
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return UUID_V4.test(t) ? t : undefined;
}

/**
 * Binds `req.requestId`, optional consultation/call correlation headers,
 * and AsyncLocalStorage for the request.
 */
export class RequestIdMiddleware {
  use = (req: Request, _res: Response, next: NextFunction): void => {
    const requestId = pickRequestId(req);
    req.requestId = requestId;
    const consultationId = pickOptionalUuidHeader(
      req.headers['x-heydoctor-consultation-id'],
    );
    const callId = pickOptionalUuidHeader(req.headers['x-heydoctor-call-id']);
    enterRequestContext({ requestId, consultationId, callId });
    next();
  };
}
