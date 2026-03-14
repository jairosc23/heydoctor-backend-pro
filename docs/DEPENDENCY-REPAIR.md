# Reparación de dependencias y arquitectura - HeyDoctor Backend

## Dependencias añadidas

Se han añadido las siguientes dependencias explícitas para evitar ERR_MODULE_NOT_FOUND:

| Paquete | Uso |
|---------|-----|
| dotenv | Carga de .env en scripts (migrate) |
| into-stream | Provider de upload cifrado |
| jsonwebtoken | WebSockets (verificación JWT) |
| pdfkit | Generación de PDFs |
| qrcode | Generación de códigos QR |
| uuid | Identificadores únicos |
| web-push | Notificaciones push (Expo) |

## Reparación de arquitectura (db, auditoriaController)

Se han creado los módulos que faltaban:

| Archivo | Descripción |
|---------|-------------|
| `db/index.js` | Pool de PostgreSQL (`pg`) para consultas raw. Usa variables de entorno `DATABASE_*`. |
| `controllers/auditoriaController.js` | Controlador de auditoría que usa el pool `db`. |

El `auditoriaController` exporta `query(sql, params)` y `pool` para uso directo. La API de auditoría principal sigue siendo `api::audit-log.audit-log` (Strapi).

## Comandos de reparación

```bash
# Reinstalar todas las dependencias
rm -rf node_modules package-lock.json
npm install

# O solo instalar
npm install
```

## Error ECONNREFUSED (base de datos)

Si el backend muestra `AggregateError [ECONNREFUSED]`, **PostgreSQL no está corriendo** o no es accesible.

**Solución:**

1. Iniciar PostgreSQL:
   ```bash
   # macOS (Homebrew)
   brew services start postgresql@14
   # o
   pg_ctl -D /usr/local/var/postgres start

   # Docker
   docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=heydoctor postgres:14
   ```

2. Crear la base de datos si no existe:
   ```bash
   createdb heydoctor
   ```

3. Verificar `.env` con los valores correctos:
   ```
   DATABASE_HOST=localhost
   DATABASE_PORT=5432
   DATABASE_NAME=heydoctor
   DATABASE_USERNAME=postgres
   DATABASE_PASSWORD=tu_password
   ```

## Si persisten errores de módulos

1. **Node.js**: Usar Node 18 o 20 (Strapi 4 recomienda <=20.x). Con Node 24 puede haber incompatibilidades.
   ```bash
   nvm use 20
   # o
   nvm use 18
   ```

2. **Limpiar caché**:
   ```bash
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```
