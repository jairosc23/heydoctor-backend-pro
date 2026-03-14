# Seguridad de archivos clínicos y auditoría

## 1. Acceso seguro a archivos clínicos

### Endpoint seguro

En lugar de acceder directamente a URLs de archivos, usar:

```
GET /api/files/:type/:filename
```

**Tipos válidos:** `documents`, `captures`, `annotations`, `reports`

**Ejemplo:** `GET /api/files/documents/123` (donde 123 es el fileId)

**Query opcional:** `?fileId=123` para especificar el ID del archivo

### Reglas de acceso

- **Doctor**: puede acceder a archivos de sus consultas (appointments donde es el doctor)
- **Paciente**: puede acceder a archivos de sus propias consultas

### Autenticación

Requiere token JWT en el header `Authorization: Bearer <token>`.

### Auditoría

Cada descarga exitosa registra la acción `VIEW_DOCUMENT` en `audit_logs`.

---

## 2. Auditoría de acceso a historias clínicas

### Acciones registradas

| Acción | Cuándo |
|--------|--------|
| `VIEW_MEDICAL_RECORD` | Al abrir GET /patients/:id o GET /clinical-records/:id |
| `EXPORT_MEDICAL_RECORD` | Al exportar GET /patients/:id/medical-record |
| `VIEW_DOCUMENT` | Al descargar un archivo vía GET /files/:type/:filename |

### Datos almacenados en audit_logs

- `user_id` - ID del usuario
- `patient_id` - ID del paciente (cuando aplica)
- `ip_address` - IP del cliente
- `user_agent` - User-Agent del navegador
- `metadata` - Datos adicionales (file_id, etc.)
- `action` - Nombre de la acción
- Timestamp (createdAt)

---

## 3. Exportación de historia clínica

### Endpoint

```
GET /api/patients/:id/medical-record
```

### Permisos

- **Doctor**: debe tener al menos una cita con ese paciente
- **Paciente**: solo su propia historia clínica

### Auditoría

Cada exportación registra `EXPORT_MEDICAL_RECORD`.

---

## Nota sobre Cloudinary

Este proyecto usa Cloudinary para almacenar archivos. Las URLs de Cloudinary se devuelven en las respuestas de la API. Para máxima seguridad:

1. Usar el endpoint seguro `/api/files/:type/:filename` en lugar de URLs directas
2. Considerar Cloudinary signed URLs o private delivery para archivos muy sensibles
