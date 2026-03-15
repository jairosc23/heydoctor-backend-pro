# Doctor Stickiness Features – Adopción Diaria

Este documento describe las funcionalidades de adhesión del Doctor Workspace: **Consultation Templates**, **Favorite Orders** y **Patient Reminders**. Su objetivo es aumentar la productividad médica y reducir el tiempo por consulta.

---

## 1. Consultation Templates

### Descripción

Sistema de plantillas de consulta que permite al médico crear y reutilizar configuraciones predefinidas.

### Ubicación

- **Configuración del médico:** `/doctor/templates` – CRUD completo de plantillas
- **Durante la consulta:** selector "Usar plantilla" para autocompletar

### Contenido de cada plantilla

| Campo | Descripción |
|-------|-------------|
| `name` | Nombre (ej: "Control hipertensión", "Consulta pediátrica") |
| `default_symptoms` | Síntomas por defecto |
| `recommended_diagnostics` | Diagnósticos recomendados (código CIE-10) |
| `suggested_treatments` | Tratamientos sugeridos |
| `clinical_note_template` | Plantilla de nota clínica |

### Ejemplos de plantillas

- **Consulta general** – Síntomas genéricos, nota estándar
- **Control de hipertensión** – Síntomas relacionados, diagnósticos I10, tratamientos antihipertensivos
- **Consulta pediátrica** – Síntomas pediátricos, dosis ajustadas
- **Infección respiratoria** – Síntomas respiratorios, diagnósticos J00-J99

### Flujo de uso

1. En **Doctor Settings** → `/doctor/templates`, el médico crea/edita plantillas
2. Durante la consulta, hace clic en **"Usar plantilla"**
3. Selecciona una plantilla
4. Se autocompletan síntomas, diagnósticos sugeridos, tratamientos y nota clínica

### Cómo mejora la productividad

- Menos tiempo escribiendo datos repetitivos
- Consistencia en consultas similares
- Menos errores por omisión
- Flujo más rápido en controles crónicos

### APIs

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/templates` | Listar plantillas del médico/clínica |
| POST | `/api/templates` | Crear plantilla |
| PUT | `/api/templates/:id` | Actualizar plantilla |
| DELETE | `/api/templates/:id` | Eliminar plantilla |

---

## 2. Favorite Orders

### Descripción

Panel **FavoriteOrders** que permite guardar y reutilizar órdenes frecuentes: diagnósticos, tratamientos y recetas.

### Ubicación

Integrado dentro del panel **QuickOrders** durante la consulta.

### Estructura de un favorito

```json
{
  "name": "Hypertension basic treatment",
  "items": [
    { "type": "diagnostic", "value": "I10 - Hipertensión esencial" },
    { "type": "treatment", "value": "Losartan" },
    { "type": "treatment", "value": "Lifestyle counseling" },
    { "type": "prescription", "value": "Follow-up in 2 weeks" }
  ]
}
```

### Flujo de uso

1. El médico añade diagnósticos, tratamientos o recetas durante la consulta
2. Hace clic en **"Guardar actual como favorito"**
3. Asigna un nombre (ej: "Hypertension basic treatment")
4. En consultas futuras, hace clic en el favorito para aplicar todos los ítems con 1 clic

### Cómo mejora la productividad

- 1–2 clics para aplicar un conjunto completo de órdenes
- Menos repetición en condiciones crónicas frecuentes
- Menos riesgo de olvidar pasos del plan

### APIs

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/favorite-orders` | Listar favoritos |
| POST | `/api/favorite-orders` | Crear favorito |
| DELETE | `/api/favorite-orders/:id` | Eliminar favorito |

---

## 3. Patient Reminders

### Descripción

Módulo de recordatorios para pacientes: crear, listar pendientes y enviar notificaciones.

### Ubicación

- **Perfil del paciente:** componente `PatientReminders`
- **FollowUpSuggestions:** botón "Crear recordatorio" en cada sugerencia

### Tipos de recordatorio

| Tipo | Ejemplo |
|------|---------|
| `follow_up` | "Follow-up consultation in 2 weeks" |
| `lab_test` | "Repeat blood test in 1 month" |
| `screening` | "Annual check-up due" |

### Estados

- `pending` – Pendiente de envío
- `sent` – Notificación enviada al paciente
- `completed` – Completado
- `cancelled` – Cancelado

### Integración con FollowUpSuggestions

Cuando Predictive Medicine o Clinical Intelligence sugieren un seguimiento (ej: "Seguimiento en 2 semanas"), el médico puede hacer clic en **"Crear recordatorio"** para crear el recordatorio asociado al paciente.

### Flujo de uso

1. **Crear manualmente:** en el perfil del paciente → "Crear recordatorio" → mensaje y fecha
2. **Desde FollowUpSuggestions:** clic en "Crear recordatorio" en una sugerencia
3. **Enviar notificación:** clic en "Enviar notificación" (integración con sistema de notificaciones)
4. **Marcar completado:** cuando el paciente asiste o se cumple la acción

### Cómo mejora la productividad

- Menos seguimientos perdidos
- Recordatorios automáticos desde sugerencias de AI
- Mejor adherencia del paciente
- Menos tiempo gestionando seguimientos manualmente

### APIs

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/patient-reminders?filters[patient][id]=X` | Listar recordatorios del paciente |
| POST | `/api/patient-reminders` | Crear recordatorio |
| PUT | `/api/patient-reminders/:id` | Actualizar (ej: status) |
| DELETE | `/api/patient-reminders/:id` | Eliminar |

---

## 4. Integración en el flujo clínico

### Consultation Workspace

```
1. Médico abre consulta
2. [Opcional] Clic en "Usar plantilla" → selecciona plantilla → autocompleta
3. QuickOrders muestra FavoriteOrders en la parte superior
4. Médico aplica favorito o añade órdenes manualmente
5. Al finalizar, FollowUpSuggestions muestra sugerencias
6. Clic en "Crear recordatorio" para cada sugerencia aplicable
```

### Patient Profile

```
1. PatientReminders muestra recordatorios pendientes
2. Médico puede crear nuevo recordatorio
3. Enviar notificación al paciente
4. Marcar como completado
```

### Doctor Settings (/doctor/templates)

```
1. ConsultationTemplates en modo settings (settingsMode={true})
2. CRUD de plantillas
3. Crear: consulta general, control hipertensión, pediátrica, etc.
```

---

## 5. Resumen de productividad

| Funcionalidad | Beneficio principal |
|---------------|---------------------|
| **Templates** | Autocompletar consultas repetitivas en segundos |
| **Favorite Orders** | Aplicar planes completos con 1 clic |
| **Patient Reminders** | Seguimientos automáticos desde AI, menos pérdidas |

---

## 6. Componentes frontend

| Componente | Uso |
|------------|-----|
| `ConsultationTemplates` | Settings: CRUD. Consulta: selector (via TemplateSelector) |
| `TemplateSelector` | Botón "Usar plantilla" durante consulta |
| `FavoriteOrdersPanel` | Integrado en QuickOrders |
| `PatientReminders` | Perfil del paciente |
| `FollowUpSuggestions` | Con `patientId` y `onCreateReminder` para crear recordatorios |

---

## 7. Ejemplo de integración

```tsx
// Consultation page
import { TemplateSelector, QuickOrders, FollowUpSuggestions } from '@/components';
import { createPatientReminder } from '@/lib/api-stickiness';

function ConsultationPage() {
  const [symptoms, setSymptoms] = useState([]);
  const patientId = ...;

  const handleTemplateSelect = (t) => {
    setSymptoms(t.default_symptoms ?? []);
    // aplicar recommended_diagnostics, suggested_treatments, clinical_note_template
  };

  const handleCreateReminder = async (message, dueDate) => {
    await createPatientReminder({ patient: patientId, message, due_date: dueDate });
  };

  return (
    <>
      <TemplateSelector onSelect={handleTemplateSelect} />
      <QuickOrders symptoms={symptoms} onAddDiagnostic={...} />
      <FollowUpSuggestions
        symptoms={symptoms}
        patientId={patientId}
        onCreateReminder={handleCreateReminder}
      />
    </>
  );
}

// Patient profile
<PatientReminders patientId={patientId} />

// Doctor settings /doctor/templates
<ConsultationTemplates settingsMode />
```
