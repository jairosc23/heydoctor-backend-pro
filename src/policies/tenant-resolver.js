'use strict';

/**
 * Multi-tenant policy: resolves clinic_id from authenticated user and attaches to ctx.state.
 * Must run after auth policy. Use on routes that require clinic context.
 */
module.exports = async (policyContext, config, { strapi }) => {
  const user = policyContext.state?.user;
  if (!user) {
    policyContext.state.clinicId = null;
    policyContext.state.clinic = null;
    return true; // Let auth policy handle 401 for protected routes
  }

  const clinicUser = await strapi.db.query('api::clinic-user.clinic-user').findOne({
    where: { user: user.id },
    populate: { clinic: true },
  });

  if (!clinicUser || !clinicUser.clinic) {
    policyContext.state.clinicId = null;
    policyContext.state.clinic = null;
    // For clinic-scoped routes, reject if no clinic
    if (config?.requireClinic) {
      return policyContext.unauthorized('Usuario no asociado a ninguna clínica');
    }
    return true;
  }

  policyContext.state.clinicId = clinicUser.clinic.id;
  policyContext.state.clinic = clinicUser.clinic;
  policyContext.state.clinicUserRole = clinicUser.role;
  return true;
};
