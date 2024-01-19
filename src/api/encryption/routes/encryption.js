'use strict'

module.exports = {
  routes: [
    {
     method: 'GET',
     path: '/encryption',
     handler: 'encryption.getKeys',
     config: {
       policies: [],
     },
    },
  ],
};
