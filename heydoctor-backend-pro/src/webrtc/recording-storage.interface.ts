/**
 * Recording storage abstraction — **no provider SDKs or bucket names here**.
 *
 * ## Plugging a concrete backend
 *
 * 1. Implement `RecordingStorageAdapter` in an infrastructure module (e.g. `StorageModule`).
 * 2. Inject the adapter into the recording pipeline service (when media upload exists).
 * 3. Map `prepare.context.storagePath` to the provider’s object key or prefix:
 *    - **AWS S3** (and MinIO, Cloudflare R2, etc.): `Bucket` + `Key` derived from `storagePath`.
 *    - **GCP Cloud Storage**: bucket + object name from `storagePath`.
 *    - **Azure Blob**: container + blob path from `storagePath`.
 * 4. Use `encryptionKeyId` only as a **reference** to a KMS key version (never log raw keys).
 * 5. Register the implementation with Nest `useClass` / `useFactory` so tests can swap in memory fakes.
 *
 * Session rows (`RecordingSession`) hold `storagePath` and `encryptionKeyId` as the contract with this layer.
 *
 * @see RecordingSession entity for persisted metadata fields.
 */

/**
 * Input for reserving upload capacity / object keys. No PHI — only opaque paths and key ids.
 */
export type RecordingStoragePrepareContext = {
  /** Same as DB primary key for the recording session row. */
  recordingSessionId: string;
  /**
   * Logical path prefix produced by the domain layer (e.g. `recordings/clinic/{clinicId}/sessions/{id}/pending`).
   * Adapters map this to provider-specific bucket + key naming.
   */
  storagePath: string;
  /**
   * KMS / vault key identifier for envelope encryption (placeholder until real KMS wiring).
   */
  encryptionKeyId: string;
};

/**
 * Opaque pointer after `prepareUpload` — implementation defines `bucket` vs container vs account semantics.
 */
export type RecordingObjectPointer = {
  /** Provider-specific bucket/container/account label (config-driven, not hardcoded here). */
  bucket: string;
  objectKey: string;
  encryptionAlgorithm?: string;
  encryptionKeyId?: string;
};

/**
 * Strict boundary between domain recording logic and blob stores.
 */
export interface RecordingStorageAdapter {
  /**
   * Reserve multipart upload / object key (no media bytes yet).
   */
  prepareUpload(context: RecordingStoragePrepareContext): Promise<RecordingObjectPointer>;

  /**
   * Mark upload complete after integrity checks (implementation-defined).
   */
  finalizeUpload(context: RecordingStoragePrepareContext): Promise<{ ok: true }>;
}
