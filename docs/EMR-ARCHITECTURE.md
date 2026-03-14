# Arquitectura EMR - HeyDoctor

## Módulos

### modules/consultations/

Lógica de consultas y teleconsulta.

- **consultations.service.js** – Lógica de negocio: CRUD, ciclo de vida, join
- **consultations.controller.js** – Validación, autenticación, llamadas al servicio
- **consultations.validators.js** – Validación de entrada

**Rutas (API consultation):**

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /api/consultations/:id/start | Iniciar consulta |
| POST | /api/consultations/:id/doctor-join | Doctor se une |
| POST | /api/consultations/:id/patient-join | Paciente se une |
| PATCH | /api/consultations/:id/status | Cambiar estado |

**Estados:** scheduled → in_progress → completed | cancelled | no_show

---

### modules/core/models/

Modelos de dominio.

- **Patient.js** – Propiedad del paciente, referencias a historia clínica
- **Consultation.js** – Transiciones de estado, permisos de participantes
- **Document.js** – Versiones, metadatos de firma, validación de acceso

---

### modules/events/

- **eventBus.js** – EventEmitter interno para desacoplar módulos

**Eventos emitidos:**

| Evento | Payload | Origen |
|--------|---------|--------|
| CONSULTATION_STARTED | { consultationId } | consultations.service |
| IMAGE_CAPTURED | { consultationId, imageId } | appointment lifecycle |
| DOCUMENT_SIGNED | { documentId, doctorId } | (pendiente de firma) |

---

### modules/audit/audit.events.js

Escucha: DOCUMENT_SIGNED, CONSULTATION_STARTED, IMAGE_CAPTURED → crea audit log

### modules/media/media.events.js

Escucha: IMAGE_CAPTURED → asocia imagen a la cita

### modules/clinical/clinical.events.js

Escucha: CONSULTATION_STARTED, DOCUMENT_SIGNED → actualiza timeline

---

## Uso del eventBus

```js
const eventBus = require('./modules/events/eventBus');

eventBus.emit('DOCUMENT_SIGNED', { documentId: 1, doctorId: 2 });
```

---

## Compatibilidad

- CRUD de appointments sigue en Strapi (api::appointment.appointment)
- WebRTC, videocall, documentos sin cambios
- Los módulos se integran con Strapi vía bootstrap y controllers
