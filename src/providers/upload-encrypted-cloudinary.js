'use strict';

const cloudinaryProvider = require('@strapi/provider-upload-cloudinary');
const intoStream = require('into-stream');
const { file: { streamToBuffer } } = require('@strapi/utils');
const { encryptFile, isEncryptionEnabled } = require('../utils/file-encryption');

/**
 * Cloudinary upload provider with encryption at rest.
 * Encrypts file buffer before uploading to Cloudinary.
 */
module.exports = {
  init(options) {
    const original = cloudinaryProvider.init(options);

    const encryptAndUpload = async (file, customConfig = {}) => {
      let buffer;
      if (file.buffer) {
        buffer = file.buffer;
      } else if (file.stream || file.getStream) {
        const stream = file.stream || file.getStream();
        buffer = await streamToBuffer(stream);
      } else {
        throw new Error('Missing file stream or buffer');
      }

      if (isEncryptionEnabled()) {
        buffer = encryptFile(buffer);
      }

      file.buffer = buffer;
      file.stream = intoStream(buffer);
      await original.uploadStream(file, customConfig);

      if (isEncryptionEnabled()) {
        file.provider_metadata = file.provider_metadata || {};
        file.provider_metadata.encrypted = true;
      }
    };

    return {
      uploadStream(file, customConfig) {
        return encryptAndUpload(file, customConfig);
      },
      upload(file, customConfig) {
        return encryptAndUpload(file, customConfig);
      },
      delete: original.delete,
    };
  },
};
