# FRONTEND AUDIT REPORT

**Proyecto:** HeyDoctor Frontend (Next.js)  
**Backend:** https://heydoctorbackend-production.up.railway.app/api (NestJS)  
**Fecha:** Marzo 7, 2025  
**Objetivo:** Auditoría técnica y de producto antes de implementar nueva arquitectura (Doctor Workspace)

---

## 1. Current Architecture Overview

### 1.1 Tipo de frontend

El directorio `frontend/` **no es una aplicación Next.js autónoma**. Es una **biblioteca de componentes y utilidades** para ser consumida por una app host (probablemente un monorepo o aplicación externa). No existe:

- `app/` o `pages/` propia
- `package.json` independiente
- Rutas, layouts ni estructura de Next.js App Router/Pages Router

### 1.2 Estructura actual

```
frontend/
├── components/          # ~20 componentes React
│   ├── DoctorDashboardPanels.tsx
│   ├── AiConsultationPanel.tsx
│   ├── LabOrdersPanel.tsx
│   ├── PrescriptionPanel.tsx
│   ├── SmartDiagnosisPicker.tsx
│   ├── ClinicalNoteEditor.tsx
│   ├── GenerateClinicalNoteButton.tsx
│   ├── PatientTimeline.tsx
│   └── ...
├── context/
│   └── ClinicContext.tsx
├── lib/
│   ├── api-auth.ts
│   ├── api-clinic.ts
│   ├── api-ai.ts
│   ├── api-stickiness.ts
│   └── api-analytics.ts
└── types/
    └── ...
```

### 1.3 Estado y contexto

| Aspecto | Implementación actual |
|---------|------------------------|
| **Estado global** | Solo `ClinicContext` (clinicId, clinicName, clinicSlug) |
| **Tipos de ID** | `clinicId` como `number`; pacientes/citas como `number` o `string` |
| **Data fetching** | `fetch` nativo, sin React Query/TanStack Query |
| **Auth** | `localStorage` con `jwt` / `token`; sin refresh, sin rutas protegidas |
| **API base** | Variable de entorno `NEXT_PUBLIC_API_URL` |

### 1.4 Flujo de autenticación

- Login: `POST /api/auth/login` con `email` y `password`
- Respuesta Nest: `{ jwt, user: { id, email, firstName, lastName } }`
- Token guardado en `localStorage` como `jwt` o `token`
- No hay logout definido
- No hay middleware ni HOC para rutas protegidas

---

## 2. Critical Issues

### 2.1 Incompatibilidad de formatos API

| Problema | Frontend | Backend Nest |
|----------|----------|--------------|
| **Filtros de pacientes** | `?filters[clinic][id][$eq]=` (Strapi) | `clinicId` del JWT vía decorator |
| **Filtros de appointments** | Query Strapi | `AppointmentFiltersDto` (dateFrom, dateTo) |
| **POST lab-orders** | `{ data: { patient, doctor, ... } }` | DTO directo, `clinicId`/`doctorId` del auth |
| **POST prescriptions** | `{ data: { patient, ... } }` | DTO directo |
| **Sugerencias** | `?diagnosis=` | `?q=` en suggest-lab-tests y suggest-medications |

### 2.2 Tipos de identificadores

- Frontend: `clinicId: number`, `patient.id` numérico, referencias Strapi
- Backend Nest: UUIDs (`string`)
- El `ClinicContext` y componentes asumen IDs numéricos; Nest usa UUIDs en todas las entidades

### 2.3 Estructura de datos esperada

- `PatientTimeline` espera `appointments`, `clinical_record` con estructura Strapi (`attributes`, etc.)
- Backend Nest devuelve DTOs planos (sin `attributes`)
- El endpoint `GET /api/patients/:id/medical-record` devuelve estructura diferente a la que parsea `PatientTimeline`

### 2.4 Falta de persistencia de diagnóstico

- `SmartDiagnosisPicker` busca diagnósticos (CDSS/search) pero **no** llama a `POST /api/diagnosis`
- El diagnóstico seleccionado no se persiste en la consulta ni en el expediente

### 2.5 Flujo de consultas inexistente

- No hay llamadas a `POST /api/consultations`
- No hay flujo que cree una consulta antes de diagnóstico, prescripciones ni órdenes de laboratorio

---

## 3. Backend Integration Gaps

### 3.1 Endpoints del backend NO usados por el frontend

| Módulo | Endpoints | Estado |
|--------|-----------|--------|
| **diagnosis** | `GET/POST /api/diagnosis` | No usados |
| **ai-insights** | `GET/POST /api/ai-insights/patient/:id`, `POST /api/ai-insights/generate` | No usados |
| **consultations** | `GET/POST /api/consultations` | No usados |
| **clinical-intelligence** | Endpoints de clinical intelligence | Parcialmente (usa `/clinical-insight`) |
| **predictive-medicine** | Endpoints predictivos | No usados |
| **templates** | Templates de órdenes/notas | No usados |
| **patient-reminders** | Recordatorios | No usados |

### 3.2 Parámetros incorrectos

| Llamada | Frontend envía | Backend espera |
|---------|----------------|----------------|
| `suggestLabTests` | `?diagnosis=` | `?q=` |
| `suggestMedications` | `?diagnosis=` | `?q=` |
| `createLabOrder` | `{ data: {...} }` | DTO directo |
| `createPrescription` | `{ data: {...} }` | DTO directo |

### 3.3 Autorización

- Las APIs del frontend pasan el token en header `Authorization: Bearer <token>`
- El backend usa `clinicId` y `doctorId` del JWT; el frontend envía `clinicId` en el body
- Posible redundancia y riesgo de inconsistencia si el body no coincide con el token

---

## 4. Clinical Workflow Gaps

### 4.1 Capacidades del backend vs frontend

| Capacidad | Backend | Frontend |
|-----------|---------|----------|
| Pacientes | ✅ CRUD | ✅ Lista (con filtros incorrectos) |
| Consultas | ✅ CRUD | ❌ No crea consultas |
| Diagnóstico | ✅ CRUD | ❌ Solo búsqueda, no persistencia |
| Prescripciones | ✅ CRUD | ⚠️ UI existe, formato API incorrecto |
| Órdenes de laboratorio | ✅ CRUD | ⚠️ UI existe, formato API incorrecto |
| AI Insights | ✅ Generar por paciente | ❌ Usa `/clinical-insight` alternativo |
| Nota clínica | N/A (templates) | ⚠️ Solo UI, no se guarda en backend |
| Expediente médico | ✅ `/patients/:id/medical-record` | ⚠️ Estructura incompatible |

### 4.2 Flujo clínico esperado vs implementado

| Paso | Esperado | Actual |
|------|----------|--------|
| 1. Seleccionar paciente | ✅ | ✅ |
| 2. Crear/abrir consulta | Crear consultation | ❌ No existe |
| 3. Registrar motivo/nota | Chief complaint, HPI | ⚠️ UI, no persistido |
| 4. Diagnóstico | POST diagnosis | ❌ Solo búsqueda |
| 5. Prescripción | POST prescription | ⚠️ Formato incorrecto |
| 6. Órdenes de lab | POST lab-order | ⚠️ Formato incorrecto |
| 7. Cerrar consulta | Actualizar consultation | ❌ No existe |

### 4.3 Conclusión del flujo

**No es posible completar una consulta clínica completa** con el frontend actual porque:

1. No se crea ni se cierra una consulta (consultation)
2. No se persiste el diagnóstico
3. Prescripciones y órdenes de lab fallan por formato incorrecto
4. La nota clínica no se persiste en el backend

---

## 5. UX Problems

### 5.1 Workflow médico

- **Falta de orden:** No hay flujo guiado paso a paso (crear consulta → anamnesis → diagnóstico → tratamiento).
- **Paneles desconectados:** AiConsultationPanel, LabOrdersPanel, PrescriptionPanel actúan independientes; no hay contexto compartido de “consultación actual”.
- **Sin estado de consulta:** No se distingue “consulta en curso” vs “historial”; todo parece simultáneo.

### 5.2 Pasos faltantes

1. **Inicio de consulta:** No hay botón/flujo para “iniciar consulta” que cree un `consultation` en backend.
2. **Vínculo consulta ↔ diagnóstico/prescripción/lab:** No hay `consultationId` que agrupe las entradas.
3. **Cierre de consulta:** No hay forma de marcar la consulta como completada.
4. **AI Insights:** No se muestra ni se genera insight por paciente desde el frontend.

### 5.3 Feedback al usuario

- Posible falta de manejo explícito de errores 401/403 en muchas llamadas.
- Mensajes de éxito/error pueden ser inconsistentes entre componentes.
- No hay indicadores claros de “guardado” vs “borrador” para notas o prescripciones.

### 5.4 Nota clínica

- `GenerateClinicalNoteButton` genera texto con IA; `ClinicalNoteEditor` permite editar.
- **No hay persistencia:** la nota no se envía al backend.
- Backend tiene `templates`; no hay integración con ellos.

---

## 6. Technical Debt

### 6.1 Arquitectura

- **Ausencia de capas:** Lógica de API y lógica de negocio mezcladas en componentes.
- **Sin servicio de API centralizado:** Cada módulo usa `fetch` directamente; no hay cliente unificado.
- **Duplicación:** Patrones de `fetch` repetidos (headers, manejo de errores).
- **Tipos:** Uso de `any` en varios lugares (ej. `PatientTimeline`, respuestas de API).

### 6.2 Estado

- Sin React Query/TanStack Query: no hay cache, refetch, optimistic updates.
- Sin estado de formulario robusto (Formik, React Hook Form) para flujos complejos.
- `ClinicContext` limitado; no hay contexto de “consultación actual” ni “paciente seleccionado” centralizado.

### 6.3 Componentes

- Algunos componentes grandes (DoctorDashboardPanels) con múltiples responsabilidades.
- Mezcla de UI y lógica de negocio.
- Falta de design system unificado (clases Tailwind ad-hoc).

### 6.4 Testing y documentación

- No se observan tests (unitarios, integración, E2E).
- Documentación de componentes y APIs limitada.

---

## 7. Recommended Architecture (high-level)

### 7.1 Capas sugeridas

```
┌─────────────────────────────────────────────────────────┐
│  Pages / App Router                                      │
├─────────────────────────────────────────────────────────┤
│  Features (Doctor Workspace, Patient List, etc.)         │
│  - Components                                            │
│  - Hooks (useConsultation, usePatient, etc.)             │
├─────────────────────────────────────────────────────────┤
│  API Layer                                               │
│  - api-client (fetch + auth + interceptors)              │
│  - api/patients, api/consultations, api/diagnosis, etc.  │
├─────────────────────────────────────────────────────────┤
│  State / Data                                            │
│  - React Query (server state)                            │
│  - Context (auth, clinic, current consultation)           │
├─────────────────────────────────────────────────────────┤
│  Backend Nest API                                        │
└─────────────────────────────────────────────────────────┘
```

### 7.2 Cambios clave

1. **API client unificado:** Un solo cliente con base URL, headers de auth, y manejo de errores.
2. **Servicios por dominio:** `patientsService`, `consultationsService`, `diagnosisService`, etc., que llamen a los endpoints Nest correctos.
3. **Hooks con React Query:** `usePatients()`, `useConsultation(id)`, `useCreatePrescription()`, etc.
4. **Contexto de consulta:** `ConsultationContext` con `currentConsultation`, `patient`, flujo paso a paso.
5. **Flujo clínico explícito:** Wizard o pasos: Crear consulta → Anamnesis → Diagnóstico → Tratamiento (prescripciones + lab) → Cerrar.

### 7.3 Integración con backend Nest

- Usar DTOs compatibles con Nest (sin wrapper `data` cuando no lo espera).
- Pasar solo `patientId`, `consultationId` donde aplique; dejar que `clinicId` y `doctorId` vengan del JWT.
- Adaptar respuestas del backend a modelos de frontend mediante mappers si es necesario.

---

## 8. Priority Fix List (ordered)

### Fase 1: Compatibilidad básica (bloqueantes)

| # | Tarea | Detalle |
|---|-------|---------|
| 1 | Corregir formato `createLabOrder` | Enviar DTO directo, sin wrapper `data` |
| 2 | Corregir formato `createPrescription` | Enviar DTO directo, sin wrapper `data` |
| 3 | Corregir parámetros `suggestLabTests` | Usar `q` en lugar de `diagnosis` |
| 4 | Corregir parámetros `suggestMedications` | Usar `q` en lugar de `diagnosis` |
| 5 | Eliminar filtros Strapi en pacientes/appointments | Usar endpoints Nest que obtienen `clinicId` del JWT |
| 6 | Unificar tipos de ID a UUID (string) | Cambiar clinicId, patientId, etc. a string |

### Fase 2: Flujo clínico mínimo

| # | Tarea | Detalle |
|---|-------|---------|
| 7 | Implementar creación de consulta | `POST /api/consultations` al iniciar consulta |
| 8 | Persistir diagnóstico | `POST /api/diagnosis` desde SmartDiagnosisPicker con `consultationId` |
| 9 | Vincular prescripciones y lab orders a consulta | Incluir `consultationId` en DTOs |
| 10 | Adaptar PatientTimeline | Parsear estructura de `/patients/:id/medical-record` (formato Nest) |

### Fase 3: Completitud del flujo

| # | Tarea | Detalle |
|---|-------|---------|
| 11 | Persistir nota clínica | Crear endpoint o usar templates; guardar en consultation |
| 12 | Integrar AI Insights | Usar `/api/ai-insights` para paciente; mostrar en panel |
| 13 | Cierre de consulta | Actualizar consultation como completada |
| 14 | Manejo de errores y feedback | Toasts, mensajes de éxito/error consistentes |

### Fase 4: Arquitectura y deuda técnica

| # | Tarea | Detalle |
|---|-------|---------|
| 15 | API client centralizado | Un solo cliente con interceptors |
| 16 | React Query | Migrar data fetching a hooks con cache |
| 17 | ConsultationContext | Estado de consulta actual compartido |
| 18 | Refactor componentes | Separar UI de lógica; crear design system base |

---

## Resumen ejecutivo

El frontend actual es una **biblioteca de componentes** preparada para un backend tipo Strapi. El backend Nest ofrece un modelo de datos y flujo clínico más completo, pero el frontend **no está alineado** con él.

**Bloqueadores principales:**

1. Formato de request incorrecto (wrapper `data`, parámetros equivocados).
2. No existe flujo de consultas (`consultations`).
3. Diagnóstico no se persiste.
4. Estructura de expediente y timeline incompatible.

**Consecuencia:** No es posible completar una consulta clínica end-to-end con el frontend actual.

**Recomendación:** Ejecutar las correcciones de Fase 1 para desbloquear prescripciones y lab orders; luego Fase 2 para habilitar el flujo de consulta completo. La Fase 4 puede hacerse en paralelo para mejorar mantenibilidad.

---

*Fin del reporte*
