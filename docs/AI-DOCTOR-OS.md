# AI Doctor OS – Clinical Apps Framework

Documentación del ecosistema de apps clínicas integradas en HeyDoctor, que convierte la plataforma en un **AI Doctor OS** extensible sin modificar la arquitectura existente.

---

## 1. Visión general

El **AI Doctor OS** extiende HeyDoctor con una capa de **Clinical Apps** que permite:

- Registrar apps clínicas dentro del sistema
- Integrar con recursos FHIR existentes
- Controlar qué apps está activas por clínica
- Mostrar apps en el Doctor Workspace

### Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        AI Doctor OS – HeyDoctor                          │
├─────────────────────────────────────────────────────────────────────────┤
│  Doctor Workspace                                                        │
│  ├── AiConsultationPanel (Copilot, CDSS, Predictive, Clinical Apps)       │
│  ├── DoctorDashboardPanels (Appointments, Alerts, Clinical Apps)         │
│  └── PatientInsightsPanel                                                │
├─────────────────────────────────────────────────────────────────────────┤
│  Clinical Apps Framework                                                 │
│  ├── Registry (lab-orders, radiology, pharmacy, remote-monitoring)       │
│  ├── Permissions (por clínica: enabled_clinical_apps)                   │
│  └── FHIR Integration (Patient, Encounter, Observation, MedicationReq)  │
├─────────────────────────────────────────────────────────────────────────┤
│  Capas existentes                                                        │
│  Medical AI │ CDSS │ Predictive │ Clinical Intelligence │ Knowledge Graph│
│  FHIR │ Compliance │ Field Encryption                                   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Clinical Apps Framework

### Ubicación

- **Módulo:** `modules/clinical-apps/`
- **API:** `src/api/clinical-apps/`
- **Endpoints:** `GET /api/clinical-apps`, `GET /api/clinical-apps/:name`, `GET /api/clinical-apps/fhir-resources`

### Estructura de una app

Cada app clínica tiene:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `name` | string | Identificador único (ej: `lab-orders`) |
| `description` | string | Descripción para el médico |
| `routes` | array | Rutas de la app (path, method) |
| `permissions` | string[] | Permisos FHIR requeridos |
| `icon` | string | Icono (flask, image, pill, heart, app) |
| `category` | string | Categoría (lab, imaging, pharmacy, monitoring) |

### Registro de apps

Archivo: `modules/clinical-apps/registry.js`

```javascript
const { registerClinicalApp } = require("./modules/clinical-apps");

registerClinicalApp({
  name: "lab-orders",
  description: "Laboratory test ordering",
  routes: [
    { path: "/lab-orders", method: "GET" },
    { path: "/lab-orders/:id", method: "GET" },
  ],
  permissions: ["fhir.patient.read", "fhir.observation.read"],
  icon: "flask",
  category: "lab",
});
```

### Apps predefinidas

| App | Descripción | Categoría |
|-----|-------------|------------|
| **lab-orders** | Laboratory test ordering | lab |
| **radiology** | Radiology and imaging orders | imaging |
| **pharmacy** | Pharmacy and medication management | pharmacy |
| **remote-monitoring** | Remote patient monitoring | monitoring |

---

## 3. Clinical App Registry

### Funciones

| Función | Descripción |
|---------|-------------|
| `registerClinicalApp(config)` | Registra una nueva app |
| `getClinicalApp(name)` | Obtiene una app por nombre |
| `listClinicalApps()` | Lista todas las apps registradas |
| `getAppsForClinic(clinic)` | Filtra apps según `enabled_clinical_apps` de la clínica |

### Comportamiento por clínica

- Si la clínica tiene `enabled_clinical_apps` definido (array de nombres), solo se devuelven esas apps.
- Si no está definido o está vacío, se devuelven todas las apps registradas.

---

## 4. Doctor UI – ClinicalAppsPanel

### Ubicación

- **Componente:** `frontend/components/ClinicalAppsPanel.tsx`
- **Integración:** DoctorDashboardPanels, AiConsultationPanel

### Uso

```tsx
import { ClinicalAppsPanel } from '@/components';

<ClinicalAppsPanel
  clinicId={clinicId}
  onSelectApp={(app) => console.log('Selected:', app.name)}
/>
```

### Props

| Prop | Tipo | Descripción |
|------|------|-------------|
| `clinicId` | number \| null | ID de la clínica (para filtrar apps) |
| `onSelectApp` | (app) => void | Callback al seleccionar una app |
| `className` | string | Clases CSS adicionales |

### Visualización

Muestra una cuadrícula de apps con:

- Icono según categoría (🧪 Lab, 🖼️ Radiology, 💊 Pharmacy, ❤️ Remote Monitoring)
- Nombre legible
- Descripción corta

---

## 5. App Permissions

### Integración con clínicas

El modelo `clinic` tiene un campo JSON:

```json
{
  "enabled_clinical_apps": ["lab-orders", "radiology", "pharmacy"]
}
```

- **Admin/Clinic:** puede configurar qué apps están activas para cada clínica.
- **API:** filtra automáticamente según `enabled_clinical_apps`.

### Permisos por app

Cada app declara permisos FHIR que necesita:

- `fhir.patient.read`
- `fhir.encounter.read`
- `fhir.observation.read`
- `fhir.medicationrequest.read`

El sistema de roles existente (users-permissions, tenant-resolver) controla el acceso a los endpoints FHIR. Las apps consumen esos endpoints con el JWT del usuario.

---

## 6. FHIR Integration

### Recursos disponibles para apps

Las apps clínicas pueden usar los recursos FHIR existentes:

| Recurso FHIR | Endpoint | Uso típico |
|--------------|----------|------------|
| **Patient** | `GET /api/fhir/patient/:id` | Datos del paciente |
| **Encounter** | `GET /api/fhir/encounter/:id` | Consulta/cita |
| **Observation** | `GET /api/fhir/observation/:id?type=clinical_record\|diagnostic` | Registros clínicos, diagnósticos |
| **MedicationRequest** | (converter disponible) | Prescripciones |

### Endpoint de recursos FHIR

```
GET /api/clinical-apps/fhir-resources
```

Devuelve la lista de recursos y endpoints disponibles para que las apps sepan cómo integrarse.

### Ejemplo de uso desde una app

```javascript
// Una app de lab-orders podría:
// 1. Obtener Patient: GET /api/fhir/patient/123
// 2. Obtener Observation (resultados): GET /api/fhir/observation/456?type=clinical_record
// 3. Crear nueva orden (futuro: POST a un endpoint de lab-orders)
```

---

## 7. Integración con AI

Las Clinical Apps coexisten con las capacidades de AI existentes:

| Módulo | Relación con Clinical Apps |
|--------|----------------------------|
| **Medical AI Engine** | Sugiere diagnósticos/tratamientos; las apps pueden consumir resultados |
| **CDSS** | Alertas clínicas; apps de lab/radiology pueden disparar alertas |
| **Predictive Medicine** | Riesgos; apps de remote-monitoring pueden alimentar datos |
| **Clinical Intelligence** | Patrones; apps pueden consultar sugerencias |
| **Knowledge Graph** | Enriquecimiento; apps pueden extender el KG con datos de lab/imaging |

Las apps no sustituyen el AI; lo complementan proporcionando flujos específicos (órdenes de lab, imágenes, farmacia, monitoreo).

---

## 8. API Reference

### GET /api/clinical-apps

Lista apps disponibles para la clínica del usuario.

**Query:** `?clinicId=123` (opcional; si no se envía, se usa la clínica del usuario autenticado)

**Respuesta:**

```json
{
  "apps": [
    {
      "name": "lab-orders",
      "description": "Laboratory test ordering",
      "routes": [...],
      "permissions": ["fhir.patient.read", "fhir.observation.read"],
      "icon": "flask",
      "category": "lab"
    }
  ]
}
```

### GET /api/clinical-apps/:name

Obtiene una app por nombre.

### GET /api/clinical-apps/fhir-resources

Lista recursos FHIR disponibles para apps.

**Respuesta:**

```json
{
  "resources": ["Patient", "Encounter", "Observation", "MedicationRequest"],
  "endpoints": {
    "Patient": { "endpoint": "/api/fhir/patient/:id", "converter": "..." },
    ...
  }
}
```

---

## 9. Extensibilidad

### Añadir una nueva app

1. En `modules/clinical-apps/registry.js`, llamar a `registerClinicalApp()` con la configuración.
2. (Opcional) Crear endpoints específicos en `src/api/` si la app requiere lógica propia.
3. La app aparecerá automáticamente en ClinicalAppsPanel para las clínicas que la tengan habilitada.

### Configurar apps por clínica

Actualizar el campo `enabled_clinical_apps` de la clínica (vía Strapi Admin o API):

```json
{
  "enabled_clinical_apps": ["lab-orders", "radiology", "pharmacy", "remote-monitoring"]
}
```

---

## 10. Resumen

| Componente | Ubicación |
|------------|-----------|
| Módulo Clinical Apps | `modules/clinical-apps/` |
| Registry | `modules/clinical-apps/registry.js` |
| API | `src/api/clinical-apps/` |
| UI Panel | `frontend/components/ClinicalAppsPanel.tsx` |
| Campo clínica | `clinic.enabled_clinical_apps` (JSON) |
| Documentación | `docs/AI-DOCTOR-OS.md` |
