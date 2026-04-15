/** Límite de jobs procesados por worker por ventana (BullMQ `limiter`). */
export const QUEUE_WORKER_LIMITER = {
  pdf: { max: 45, duration: 1000 },
  email: { max: 28, duration: 1000 },
  webhook: { max: 12, duration: 1000 },
} as const;
