'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/files/:type/:filename',
      handler: 'secure-file.download',
      config: {
        policies: ['global::tenant-resolver'],
      },
    },
  ],
};
