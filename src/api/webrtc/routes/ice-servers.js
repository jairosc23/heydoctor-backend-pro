"use strict";

module.exports = {
  routes: [
    {
      method: "GET",
      path: "/ice-servers",
      handler: "ice-servers.getIceServers",
      config: {
        auth: false,
      },
    },
  ],
};
