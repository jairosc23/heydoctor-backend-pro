# Cifrado de archivos clínicos

## Resumen

Los archivos clínicos (documentos, capturas, anotaciones, informes) se cifran con AES-256-GCM antes de almacenarse en Cloudinary y se descifran solo tras validar permisos en el endpoint seguro.

## 1. Gestión de la clave

### Generar clave

```bash
openssl rand -hex 32
```

### Variable de entorno

Añadir a `.env`:

```
FILE_ENCRYPTION_KEY=8f3a2b1c...64caractereshex
```

- **64 caracteres hex** = 32 bytes (256 bits)
- **Nunca** registrar ni exponer la clave
- Rotar periódicamente (requiere re-cifrar archivos existentes)

## 2. Flujo

### Subida

1. Usuario sube archivo
2. Backend cifra el buffer con AES-256-GCM
3. Se sube el archivo cifrado a Cloudinary
4. Se guarda `provider_metadata.encrypted = true`

### Descarga

1. Usuario solicita `GET /api/files/:type/:filename`
2. Backend valida autenticación y permisos
3. Si `encrypted === true`: descarga de Cloudinary, descifra, envía al cliente
4. Si no cifrado: redirección a URL de Cloudinary (compatibilidad)

## 3. Compatibilidad

- **Archivos antiguos**: sin cifrar, se sirven por redirección
- **Archivos nuevos**: cifrados si `FILE_ENCRYPTION_KEY` está definida
- Si no hay clave: subida y descarga sin cifrado

## 4. Seguridad

- Cifrado solo en backend
- La clave no se expone al frontend
- El endpoint seguro valida permisos antes de descifrar
