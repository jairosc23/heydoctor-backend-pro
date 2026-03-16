"use strict";

module.exports = {
  routes: [
    {
      method: "GET",
      path: "/fhir-resources",
      handler: "clinical-apps.fhirResources",
      config: {
        policies: [{ name: "global::tenant-resolver", config: { requireClinic: false } }],
      },
    },
    {
      method: "GET",
      path: "/:name",
      handler: "clinical-apps.get",
      config: {
        policies: [{ name: "global::tenant-resolver", config: { requireClinic: false } }],
      },
    },
    {
      method: "GET",
      path: "/",
      handler: "clinical-apps.list",
      config: {
        policies: [{ name: "global::tenant-resolver", config: { requireClinic: false } }],
      },
    },
  ],
};
