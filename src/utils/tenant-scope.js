'use strict';

/**
 * Multi-tenant scope helpers.
 * When clinicId is set, enforces clinic isolation. When null, allows all (backward compat).
 */
function withClinicFilter(ctx, baseFilters = {}) {
  const clinicId = ctx?.state?.clinicId;
  if (!clinicId) return baseFilters;
  return { ...baseFilters, clinic: clinicId };
}

function ensureClinicAccess(ctx, entity) {
  const clinicId = ctx?.state?.clinicId;
  if (!clinicId) return true; // No clinic context = allow (backward compat)
  const entityClinicId = entity?.clinic?.id ?? entity?.clinic;
  return entityClinicId === clinicId;
}

module.exports = { withClinicFilter, ensureClinicAccess };
