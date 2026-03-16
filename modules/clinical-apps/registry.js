"use strict";

/**
 * Clinical App Registry.
 * Registro de apps clínicas disponibles en el AI Doctor OS.
 */

const apps = new Map();

/**
 * Registra una app clínica.
 * @param {Object} config
 * @param {string} config.name - Identificador único (ej: lab-orders)
 * @param {string} config.description - Descripción para el médico
 * @param {Array<{path: string, method?: string, handler?: string}>} config.routes - Rutas de la app
 * @param {string[]} config.permissions - Permisos requeridos (ej: fhir.patient.read)
 * @param {string} [config.icon] - Icono (opcional)
 * @param {string} [config.category] - Categoría (lab, imaging, pharmacy, monitoring)
 */
function registerClinicalApp(config) {
  if (!config?.name) throw new Error("Clinical app requires name");
  const app = {
    name: config.name,
    description: config.description || "",
    routes: config.routes || [],
    permissions: config.permissions || [],
    icon: config.icon || "app",
    category: config.category || "general",
  };
  apps.set(app.name, app);
  return app;
}

function getClinicalApp(name) {
  return apps.get(name) || null;
}

function listClinicalApps() {
  return Array.from(apps.values());
}

function getAppsForClinic(clinic, allApps = listClinicalApps()) {
  const enabled = clinic?.enabled_clinical_apps;
  if (!enabled || !Array.isArray(enabled) || enabled.length === 0) {
    return allApps;
  }
  return allApps.filter((a) => enabled.includes(a.name));
}

// Registrar apps por defecto
registerClinicalApp({
  name: "lab-orders",
  description: "Laboratory test ordering",
  routes: [{ path: "/lab-orders", method: "GET" }, { path: "/lab-orders/:id", method: "GET" }],
  permissions: ["fhir.patient.read", "fhir.observation.read"],
  icon: "flask",
  category: "lab",
});

registerClinicalApp({
  name: "radiology",
  description: "Radiology and imaging orders",
  routes: [{ path: "/radiology", method: "GET" }, { path: "/radiology/order", method: "POST" }],
  permissions: ["fhir.patient.read", "fhir.encounter.read", "fhir.observation.read"],
  icon: "image",
  category: "imaging",
});

registerClinicalApp({
  name: "pharmacy",
  description: "Pharmacy and medication management",
  routes: [{ path: "/pharmacy", method: "GET" }, { path: "/pharmacy/medications", method: "GET" }],
  permissions: ["fhir.patient.read", "fhir.medicationrequest.read"],
  icon: "pill",
  category: "pharmacy",
});

registerClinicalApp({
  name: "remote-monitoring",
  description: "Remote patient monitoring",
  routes: [{ path: "/remote-monitoring", method: "GET" }, { path: "/remote-monitoring/vitals", method: "GET" }],
  permissions: ["fhir.patient.read", "fhir.observation.read"],
  icon: "heart",
  category: "monitoring",
});

module.exports = {
  registerClinicalApp,
  getClinicalApp,
  listClinicalApps,
  getAppsForClinic,
};
