'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: ':id/medical-record',
      handler: 'patient.medicalRecord',
      config: {
        policies: ['global::tenant-resolver'],
      },
    },
  ],
};
