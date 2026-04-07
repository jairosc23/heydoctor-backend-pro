/**
 * Future implementation: upload encrypted chunks to S3-compatible storage.
 * Keeps bucket credentials server-side only.
 * Session rows carry `encryptionKeyId` + `storagePath` (see RecordingSession entity).
 */
export type RecordingObjectPointer = {
  bucket: string;
  objectKey: string;
  encryptionAlgorithm?: string;
  encryptionKeyId?: string;
};

export interface RecordingStorageAdapter {
  /**
   * Reserve object key / multipart session (no PHI in metadata values).
   */
  prepareUpload(sessionId: string): Promise<RecordingObjectPointer>;

  finalizeUpload(sessionId: string): Promise<{ ok: true }>;
}
