'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/me',
      handler: 'clinic.me',
      config: {
        policies: ['global::tenant-resolver'],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/clinic/patients',
      handler: 'clinic-dashboard.patients',
      config: {
        policies: [['global::tenant-resolver', { requireClinic: true }]],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/clinic/consultations',
      handler: 'clinic-dashboard.consultations',
      config: {
        policies: [['global::tenant-resolver', { requireClinic: true }]],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/clinic/documents',
      handler: 'clinic-dashboard.documents',
      config: {
        policies: [['global::tenant-resolver', { requireClinic: true }]],
        middlewares: [],
      },
    },
  ],
};
