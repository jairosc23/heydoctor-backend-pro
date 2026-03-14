'use strict';

const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { auditLogger } = require('../../../utils/audit-logger');
const { decryptFile, isEncryptionEnabled } = require('../../../utils/file-encryption');

/**
 * Secure file download - verifies auth and permission before serving.
 * Decrypts encrypted files after validation.
 */
module.exports = {
  async download(ctx) {
    const user = ctx.state?.user;
    if (!user) return ctx.unauthorized('Autenticación requerida');

    const { type, filename } = ctx.params;
    const validTypes = ['documents', 'captures', 'annotations', 'reports'];
    if (!validTypes.includes(type)) return ctx.badRequest('Tipo de archivo no válido');

    const fileId = ctx.query?.fileId || (parseInt(filename, 10) ? parseInt(filename, 10) : null);
    let file = fileId ? await strapi.entityService.findOne('plugin::upload.file', fileId) : null;
    if (!file && filename) {
      const byHash = await strapi.db.query('plugin::upload.file').findMany({
        where: { hash: filename.replace(/\.[^.]+$/, '') },
      });
      file = byHash?.[0] || null;
    }
    if (!file) return ctx.notFound('Archivo no encontrado');

    const hasAccess = await checkFileAccess(strapi, user, file);
    if (!hasAccess) return ctx.forbidden('No tiene permiso para acceder a este archivo');

    await auditLogger(strapi, 'VIEW_DOCUMENT', ctx, {
      file_id: file.id,
      file_name: file.name,
      file_type: type,
    });

    const isEncrypted = file.provider_metadata?.encrypted === true;

    if (file.provider === 'cloudinary' && file.url) {
      if (isEncrypted && isEncryptionEnabled()) {
        try {
          const res = await axios.get(file.url, { responseType: 'arraybuffer' });
          const encrypted = Buffer.from(res.data);
          const decrypted = decryptFile(encrypted);
          ctx.type = file.mime || 'application/octet-stream';
          ctx.attachment(file.name || `file${file.ext || ''}`);
          ctx.body = decrypted;
          return;
        } catch (err) {
          strapi.log.error('Decrypt failed:', err.message);
          return ctx.internalServerError('Error al descifrar archivo');
        }
      }
      return ctx.redirect(file.url);
    }

    const localPath = path.join(process.cwd(), 'public', file.url || `uploads/${file.hash}${file.ext || ''}`);
    if (fs.existsSync(localPath)) {
      let content = fs.readFileSync(localPath);
      if (isEncrypted && isEncryptionEnabled()) {
        try {
          content = decryptFile(content);
        } catch (err) {
          strapi.log.error('Decrypt failed:', err.message);
          return ctx.internalServerError('Error al descifrar archivo');
        }
      }
      ctx.type = file.mime || 'application/octet-stream';
      ctx.attachment(file.name || `file${file.ext || ''}`);
      ctx.body = content;
      return;
    }

    return ctx.notFound('Archivo no disponible');
  },
};

async function checkFileAccess(strapi, user, file) {
  const doctor = await strapi.db.query('api::doctor.doctor').findOne({
    where: { user: user.id },
  });
  const patient = await strapi.db.query('api::patient.patient').findOne({
    where: { user: user.id },
  });

  const appointments = await strapi.entityService.findMany('api::appointment.appointment', {
    filters: { files: { id: file.id } },
    populate: ['doctor', 'patient'],
  });
  for (const apt of appointments) {
    const aptDoctorId = apt.doctor?.id ?? apt.doctor;
    const aptPatientId = apt.patient?.id ?? apt.patient;
    if (doctor && aptDoctorId === doctor.id) return true;
    if (patient && aptPatientId === patient.id) return true;
  }

  return false;
}
