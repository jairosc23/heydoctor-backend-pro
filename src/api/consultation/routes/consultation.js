'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: ':id/start',
      handler: 'consultation.start',
      config: { policies: ['global::tenant-resolver'] },
    },
    {
      method: 'POST',
      path: ':id/doctor-join',
      handler: 'consultation.doctorJoin',
      config: { policies: ['global::tenant-resolver'] },
    },
    {
      method: 'POST',
      path: ':id/patient-join',
      handler: 'consultation.patientJoin',
      config: { policies: ['global::tenant-resolver'] },
    },
    {
      method: 'PATCH',
      path: ':id/status',
      handler: 'consultation.transitionStatus',
      config: { policies: ['global::tenant-resolver'] },
    },
  ],
};
