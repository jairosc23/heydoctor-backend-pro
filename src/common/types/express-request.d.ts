import 'express-serve-static-core';

declare module 'express-serve-static-core' {
  interface Request {
    /** Correlation ID for tracing (set by RequestIdMiddleware). */
    requestId?: string;
  }
}
