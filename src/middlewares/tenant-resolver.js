'use strict';

/**
 * Multi-tenant middleware: initializes clinic context on ctx.state.
 * Actual clinic resolution happens in tenant-resolver policy (runs after auth).
 * Ensures ctx.state.clinicId and ctx.state.clinic exist for all requests.
 */
module.exports = () => {
  return async (ctx, next) => {
    ctx.state.clinicId = ctx.state.clinicId ?? null;
    ctx.state.clinic = ctx.state.clinic ?? null;
    await next();
  };
};
